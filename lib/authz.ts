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
import { hashFromAuthHeader, sha256, TOKEN_PREFIX } from "@/lib/token";

export interface Library {
  id: string;
  slug: string;
  name: string;
  github_repos: string[];
  /** 쓰기 경로의 알림이 재조회 없이 쓰도록 같이 실어 온다. 클라이언트로는 안 나간다 */
  mattermost_webhook_url: string | null;
  discord_webhook_url: string | null;
  /** 레포별 최신 이벤트 (D-012 비정규화). [stale] 판단이 추가 쿼리 없이 된다 */
  latest_event_id: number;
  /** 알림 디바운스 창의 기준점. 쓰기 경로가 이 값 하나로 발송 여부를 정한다 */
  last_notified_at: string | null;
  /** 멤버 관리·설정·이력 되돌리기를 할 수 있는 단 한 사람 (D-021). null이면 admin만 */
  owner_email: string | null;
}

const LIBRARY_COLUMNS =
  "id, slug, name, github_repos, mattermost_webhook_url, discord_webhook_url, latest_event_id, last_notified_at, owner_email";

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
    console.error("identityFromAccessToken", error.code, error.message);
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
    if (touchError) {
      console.error("identityFromAccessToken:last_used_at", touchError.code, touchError.message);
    }
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

/**
 * 이 이메일이 이 레포의 소유자인가. 멤버 관리·설정 변경·이력 되돌리기의 권한 판정용 (D-021).
 * `library_id`만 있고 `Library` 행이 없는 호출부(폼 데이터 등)를 위한 조회 버전이다 —
 * 이미 행을 들고 있다면 `library.owner_email === email`로 직접 비교하는 편이 싸다.
 */
export async function isLibraryOwner(email: string, libraryId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("libraries")
    .select("owner_email")
    .eq("id", libraryId)
    .maybeSingle();

  if (error) {
    console.error("isLibraryOwner", error.code, error.message);
    return false; // 조회 실패는 권한 없음 (fail-closed)
  }
  return data?.owner_email === email.toLowerCase();
}

/** 이 이메일이 멤버로 등록된 레포 id 목록. admin 여부는 보지 않는다. */
export async function getMemberLibraryIds(email: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("library_members")
    .select("library_id")
    .eq("email", email.toLowerCase());

  if (error) {
    console.error("getMemberLibraryIds", error.code, error.message);
    return [];
  }
  return (data ?? []).map((row: { library_id: string }) => row.library_id);
}

/**
 * 이 이메일이 볼 수 있는 레포 전체. admin은 멤버 테이블과 무관하게 전부 본다.
 * `/admin`·`/api/export`처럼 "전체 조망"이 admin 고유 권한으로 실제로 필요한 곳에만 쓴다
 * (SPEC §6: admin은 이 둘에서만 특별하다). **MCP·일반 페이지에는 쓰지 않는다** —
 * 그 두 곳 말고는 admin도 멤버십을 따라야 한다. `getMemberLibraries`를 대신 쓴다.
 */
export async function getAccessibleLibraries(email: string | null): Promise<Library[]> {
  if (!email) return [];

  const query = supabase.from("libraries").select(LIBRARY_COLUMNS).order("slug");
  const { data, error } = isAdminEmail(email)
    ? await query
    : await query.in("id", await getMemberLibraryIds(email));

  if (error) {
    console.error("getAccessibleLibraries", error.code, error.message);
    return [];
  }
  return data ?? [];
}

/**
 * 이 이메일이 **멤버로 속한** 레포만. admin이어도 예외 없다 (SPEC §6: admin은 `/admin`·
 * 내보내기에서만 특별하다). `/dashboard`처럼 "내가 가입한 것"이 화면의 정의인 곳에 쓴다 —
 * `getAccessibleLibraries`를 여기 쓰면 admin이 로그인할 때마다 전 서비스의 레포가 자기
 * 것처럼 보인다.
 */
export async function getMemberLibraries(email: string | null): Promise<Library[]> {
  if (!email) return [];

  const ids = await getMemberLibraryIds(email);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("libraries")
    .select(LIBRARY_COLUMNS)
    .in("id", ids)
    .order("slug");

  if (error) {
    console.error("getMemberLibraries", error.code, error.message);
    return [];
  }
  return data ?? [];
}

/**
 * slug로 레포를 찾되 **멤버가 아니면** null. admin도 예외 없다 (SPEC §6) —
 * `getAccessibleLibraries`(복수)와 이름이 비슷해서 헷갈리기 쉬운데, 그쪽만 admin 전체조회고
 * 이쪽은 항상 멤버십을 따른다. MCP(`doc_get`/`doc_put`/`doc_delete`)와 `/libraries/[library]`
 * 아래 모든 페이지가 이 함수 하나로 권한을 판단한다.
 *
 * 호출부는 null을 403이 아니라 **404**로 처리한다 — 403은 "그 레포가 존재한다"를 알려준다.
 */
export async function getMemberLibrary(
  email: string | null,
  slug: string,
): Promise<Library | null> {
  if (!email) return null;

  const { data: repo, error } = await supabase
    .from("libraries")
    .select(LIBRARY_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getMemberLibrary", error.code, error.message);
    return null;
  }
  if (!repo) return null;

  const { count, error: memberError } = await supabase
    .from("library_members")
    .select("email", { count: "exact", head: true })
    .eq("library_id", repo.id)
    .eq("email", email.toLowerCase());

  if (memberError) {
    console.error("getMemberLibrary:member", memberError.code, memberError.message);
    return null;
  }
  return count ? repo : null;
}

/**
 * 초대 링크 토큰 → 그 라이브러리. 무효화됐거나 형태가 안 맞으면 null (D-022).
 * `identityFromAccessToken`과 같은 모양이다 — 접두사로 먼저 거르고, 해시로 조회한다.
 * 멤버십은 안 본다 — 초대 토큰 자체가 "아직 멤버가 아닌 사람"을 위한 것이다.
 */
export async function libraryFromInviteToken(token: string): Promise<Library | null> {
  if (!token.startsWith(TOKEN_PREFIX.invite)) return null;
  const hash = sha256(token);

  const { data, error } = await supabase
    .from("library_invites")
    .select(`libraries!inner(${LIBRARY_COLUMNS})`)
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    console.error("libraryFromInviteToken", error.code, error.message);
    return null;
  }
  if (!data) return null;
  // supabase-js가 단일 관계는 객체로, `!inner`도 마찬가지로 준다 — 배열이 아니다.
  return data.libraries as unknown as Library;
}
