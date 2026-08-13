/**
 * @file lib/authz.ts
 * @description 권한 판정. 세션으로 들어왔든 토큰으로 들어왔든 최종 판단 근거는 이메일 하나다.
 *
 * 권한을 토큰에 굽지 않는다. 토큰은 이메일까지만 해석하고 레포 권한은 **요청 시점에** 조회하므로,
 * 멤버에서 빼면 토큰 재발급 없이 즉시 차단된다. (SPEC §6)
 *
 * 조회 실패는 전부 "권한 없음"으로 떨어진다(fail-closed).
 */
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hashFromAuthHeader } from "@/lib/token";

export interface Repo {
  id: string;
  slug: string;
  name: string;
  github_full_name: string | null;
  /** 쓰기 경로의 알림이 재조회 없이 쓰도록 같이 실어 온다. 클라이언트로는 안 나간다 */
  mattermost_webhook_url: string | null;
  discord_webhook_url: string | null;
  /** 레포별 최신 이벤트 (D-012 비정규화). [stale] 판단이 추가 쿼리 없이 된다 */
  latest_event_id: number;
}

const REPO_COLUMNS =
  "id, slug, name, github_full_name, mattermost_webhook_url, discord_webhook_url, latest_event_id";

// ─── 정체성 ──────────────────────────────────────────────────────────

/** 로그인 세션의 이메일(lowercase). 비로그인이면 null. */
export async function getSessionEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email?.toLowerCase() ?? null;
}

export interface TokenIdentity {
  /** `token_cursors`가 이 id로 구독 커서를 매단다 */
  id: string;
  email: string;
}

/**
 * access token(`cshn_pat_`) → 토큰 id + 이메일. 유효하지 않으면 null.
 * 여기서 레포 권한을 판단하지 않는다 — 호출부가 아래 함수들로 요청 시점에 조회한다.
 */
export async function identityFromAccessToken(
  authorizationHeader: string | null | undefined,
): Promise<TokenIdentity | null> {
  const hash = hashFromAuthHeader(authorizationHeader, "access");
  if (!hash) return null;

  const { data, error } = await supabase
    .from("access_tokens")
    .select("id, email, last_used_at")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("identityFromAccessToken", error);
    return null;
  }
  if (!data) return null;

  // 유출됐을 때 "이 토큰이 아직 살아있나"를 판단할 유일한 수단이다. (SPEC §6)
  // 그 판단에 초 단위 정밀도는 필요 없다 — 5분 안에 또 왔으면 UPDATE를 건너뛴다.
  // 에이전트는 툴을 연달아 부르므로 이 스로틀이 호출당 쓰기 하나를 지운다.
  const staleMs = 5 * 60_000;
  const touchedAt = data.last_used_at ? new Date(data.last_used_at as string).getTime() : 0;
  if (Date.now() - touchedAt > staleMs) {
    const { error: touchError } = await supabase
      .from("access_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
    if (touchError) console.error("identityFromAccessToken:last_used_at", touchError);
  }

  return { id: data.id as string, email: data.email as string };
}

// ─── 권한 ────────────────────────────────────────────────────────────

/**
 * `ADMIN_EMAILS`(콤마 구분)에 있는가.
 * 비어 있으면 전원 거부한다 — 빈 값을 "제한 없음"으로 읽는 순간 전면 개방이다. (SPEC §6)
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

/** 현재 로그인 세션이 admin인가. 서버 액션 첫 줄에서 쓴다. */
export async function isAdmin(): Promise<boolean> {
  return isAdminEmail(await getSessionEmail());
}

/** 이 이메일이 이 레포의 멤버인가. 셀프서브 멤버 관리의 권한 판정용 (D-013). */
export async function isMember(email: string, repositoryId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from("repository_members")
    .select("email", { count: "exact", head: true })
    .eq("repository_id", repositoryId)
    .eq("email", email.toLowerCase());

  if (error) {
    console.error("isMember", error);
    return false; // 조회 실패는 권한 없음 (fail-closed)
  }
  return Boolean(count);
}

/** 이 이메일이 멤버로 등록된 레포 id 목록. admin 여부는 보지 않는다. */
export async function getMemberRepoIds(email: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("repository_members")
    .select("repository_id")
    .eq("email", email.toLowerCase());

  if (error) {
    console.error("getMemberRepoIds", error);
    return [];
  }
  return (data ?? []).map((row: { repository_id: string }) => row.repository_id);
}

/** 이 이메일이 볼 수 있는 레포 전체. admin은 멤버 테이블과 무관하게 전부 본다. */
export async function getAccessibleRepos(email: string | null): Promise<Repo[]> {
  if (!email) return [];

  const query = supabase.from("repositories").select(REPO_COLUMNS).order("slug");
  const { data, error } = isAdminEmail(email)
    ? await query
    : await query.in("id", await getMemberRepoIds(email));

  if (error) {
    console.error("getAccessibleRepos", error);
    return [];
  }
  return data ?? [];
}

/**
 * slug로 레포를 찾되 접근 권한이 없으면 null.
 *
 * 호출부는 null을 403이 아니라 **404**로 처리한다 — 403은 "그 레포가 존재한다"를 알려준다.
 * (SPEC §6)
 */
export async function getAccessibleRepo(
  email: string | null,
  slug: string,
): Promise<Repo | null> {
  if (!email) return null;

  const { data: repo, error } = await supabase
    .from("repositories")
    .select(REPO_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getAccessibleRepo", error);
    return null;
  }
  if (!repo) return null;
  if (isAdminEmail(email)) return repo;

  const { count, error: memberError } = await supabase
    .from("repository_members")
    .select("email", { count: "exact", head: true })
    .eq("repository_id", repo.id)
    .eq("email", email.toLowerCase());

  if (memberError) {
    console.error("getAccessibleRepo:member", memberError);
    return null;
  }
  return count ? repo : null;
}
