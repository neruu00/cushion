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
  /**
   * 로그인 없이 문서를 **읽을** 수 있는가 (D-023). 쓰기는 이 값과 무관하게 멤버만이다.
   * 마이그레이션 전 DB에서는 컬럼이 없어 `undefined`로 온다 — 아래 `isPublic()`으로만 읽는다.
   */
  is_public?: boolean;
}

/**
 * 이 라이브러리가 공개인가. **컬럼을 직접 보지 않고 항상 이걸 지난다** —
 * `is_public`은 나중에 생긴 컬럼이라 마이그레이션 전 DB에서는 `undefined`이고,
 * 그때의 안전한 답은 "비공개"다(fail-closed).
 */
export function isPublic(library: Library): boolean {
  return library.is_public === true;
}

/**
 * `select`에 넣는 컬럼 목록.
 *
 * ⚠️ **새 컬럼을 여기 그냥 추가하면 마이그레이션 전까지 모든 라이브러리 조회가 42703으로
 * 죽는다** — 이 목록을 `getMemberLibrary`·`getAccessibleLibraries`·MCP까지 전부 공유하기
 * 때문에, 컬럼 하나가 앱 전체를 세운다(실제로 `is_public`에서 겪었다). 그래서 나중에
 * 생긴 컬럼은 아래 `OPTIONAL_COLUMNS`에 넣고, 조회가 42703으로 실패하면 그 컬럼들을
 * 빼고 한 번 더 시도한다. 마이그레이션이 돌면 첫 시도가 그냥 성공한다.
 */
const BASE_COLUMNS =
  "id, slug, name, github_repos, mattermost_webhook_url, discord_webhook_url, latest_event_id, last_notified_at, owner_email";
const OPTIONAL_COLUMNS = ["is_public"];
const LIBRARY_COLUMNS = [BASE_COLUMNS, ...OPTIONAL_COLUMNS].join(", ");

/** PostgREST: 그런 컬럼이 없다 = 마이그레이션을 아직 안 돌렸다 */
const MISSING_COLUMN = "42703";

let missingColumnNoticeShown = false;

/**
 * 라이브러리 조회를 한 번 돌리고, 새 컬럼이 없어서 실패하면 그것 없이 다시 돌린다.
 * `build(columns)`는 컬럼 목록만 받아 쿼리를 만드는 함수다 — 두 번 만들 수 있어야 한다.
 */
async function selectLibraries<T>(
  build: (columns: string) => PromiseLike<{ data: T; error: { code?: string; message?: string } | null }>,
  label: string,
): Promise<{ data: T | null; failed: boolean }> {
  const first = await build(LIBRARY_COLUMNS);
  if (!first.error) return { data: first.data, failed: false };

  if (first.error.code === MISSING_COLUMN) {
    if (!missingColumnNoticeShown) {
      missingColumnNoticeShown = true;
      console.warn(
        `authz: supabase/migrations/0001_schema.sql 을 다시 돌려야 한다(${OPTIONAL_COLUMNS.join("·")} 없음). ` +
          "그 전까지 공개 라이브러리 기능만 꺼진 채로 나머지는 정상 동작한다.",
      );
    }
    const retry = await build(BASE_COLUMNS);
    if (!retry.error) return { data: retry.data, failed: false };
    console.error(label, retry.error.code, retry.error.message);
    return { data: null, failed: true };
  }

  console.error(label, first.error.code, first.error.message);
  return { data: null, failed: true };
}

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

  const admin = isAdminEmail(email);
  const ids = admin ? null : await getMemberLibraryIds(email);

  const { data } = await selectLibraries<Library[] | null>((columns) => {
    const query = supabase.from("libraries").select(columns).order("slug");
    return (ids ? query.in("id", ids) : query) as never;
  }, "getAccessibleLibraries");

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

  const { data } = await selectLibraries<Library[] | null>(
    (columns) => supabase.from("libraries").select(columns).in("id", ids).order("slug") as never,
    "getMemberLibraries",
  );

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

  const { data: repo } = await selectLibraries<Library | null>(
    (columns) => supabase.from("libraries").select(columns).eq("slug", slug).maybeSingle() as never,
    "getMemberLibrary",
  );
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
 * **읽기 전용** 조회 결과. 공개 라이브러리는 비로그인도 여기까지는 통과한다 (D-023).
 *
 * `isMember`가 이 타입의 존재 이유다 — 화면이 "볼 수 있다"와 "손댈 수 있다"를 갈라야
 * 하는데, 라이브러리 행만으로는 그걸 알 수 없다. 편집·이력·멤버 목록처럼 멤버 전용인
 * 것들은 전부 이 값으로 가린다.
 */
export interface LibraryView {
  library: Library;
  isMember: boolean;
}

/**
 * 문서를 **읽기 위한** 조회. 멤버이거나, 라이브러리가 공개면 통과한다 (D-023).
 *
 * ⚠️ **쓰기 경로에 절대 쓰지 않는다.** 쓰기는 `getMemberLibrary`만 지난다
 * (`lib/document.ts`의 `resolve`, `actions/document.ts`) — 그게 익명 쓰기를 막는
 * 유일한 선이라, 이 함수를 거기 끼우는 순간 공개 라이브러리가 누구나 고칠 수 있게 된다.
 *
 * 비로그인이고 비공개면 null이다. 호출부는 그때 로그인으로 보내거나 404를 낸다 —
 * 어느 쪽이든 라이브러리의 존재를 알려주지 않는다.
 */
export async function getReadableLibrary(
  email: string | null,
  slug: string,
): Promise<LibraryView | null> {
  const { data: repo } = await selectLibraries<Library | null>(
    (columns) => supabase.from("libraries").select(columns).eq("slug", slug).maybeSingle() as never,
    "getReadableLibrary",
  );
  if (!repo) return null;

  if (!email) return isPublic(repo) ? { library: repo, isMember: false } : null;

  const { count, error: memberError } = await supabase
    .from("library_members")
    .select("email", { count: "exact", head: true })
    .eq("library_id", repo.id)
    .eq("email", email.toLowerCase());

  if (memberError) {
    console.error("getReadableLibrary:member", memberError.code, memberError.message);
    return null; // 조회 실패는 권한 없음 (fail-closed)
  }
  if (count) return { library: repo, isMember: true };
  return isPublic(repo) ? { library: repo, isMember: false } : null;
}

/**
 * 초대 링크 토큰 → 그 라이브러리. 무효화됐거나 형태가 안 맞으면 null (D-022).
 * `identityFromAccessToken`과 같은 모양이다 — 접두사로 먼저 거르고, 해시로 조회한다.
 * 멤버십은 안 본다 — 초대 토큰 자체가 "아직 멤버가 아닌 사람"을 위한 것이다.
 */
export async function libraryFromInviteToken(token: string): Promise<Library | null> {
  if (!token.startsWith(TOKEN_PREFIX.invite)) return null;
  const hash = sha256(token);

  const { data } = await selectLibraries<{ libraries: unknown } | null>(
    (columns) =>
      supabase
        .from("library_invites")
        .select(`libraries!inner(${columns})`)
        .eq("token_hash", hash)
        .is("revoked_at", null)
        .maybeSingle() as never,
    "libraryFromInviteToken",
  );
  if (!data) return null;
  // supabase-js가 단일 관계는 객체로, `!inner`도 마찬가지로 준다 — 배열이 아니다.
  return data.libraries as Library;
}
