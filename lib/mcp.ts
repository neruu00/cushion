/**
 * @file lib/mcp.ts
 * @description MCP 툴 — 읽기 4종 + 쓰기 3종 — 과 구독 커서. 전송 계층은 app/api/mcp/route.ts.
 *
 * **원본이 여기 있으므로 쓰기 툴이 있다** (D-011). 그래서 유출된 PAT는 열람뿐 아니라
 * 훼손도 할 수 있다 — 복구 근거는 `document_versions`뿐이다. (SPEC §6)
 *
 * 이름이 `doc_`인 이유: 여기 담기는 건 스펙만이 아니다. ADR·런북·회의록·용어집 무엇이든
 * 같은 자격으로 들어가는 **문서 도서관**이고, 툴 이름이 곧 에이전트가 읽는 용도 표시다.
 *
 * 절감의 본체가 여기다: 목차 먼저(doc_outline) → 필요한 섹션만(doc_get) →
 * 안 바뀌었으면 본문 대신 5토큰(if_none_match) → 밀렸을 때만 한 줄([stale]).
 */
import { z } from "zod";

import { getMemberLibraries, type Library, type TokenIdentity } from "@/lib/authz";
import { deleteDocument, putDocument } from "@/lib/document";
import { deleteDocumentSchema, putDocumentSchema } from "@/lib/document.schema";
import { createLibraryFor } from "@/lib/library";
import { findSection, headings, scoreSection, snippet, splitSections } from "@/lib/markdown";
import { supabase } from "@/lib/supabase";

export const SERVER_INFO = { name: "cushion", version: "0.1.0" } as const;

/**
 * `initialize` 응답에 실려 **매 세션 컨텍스트에 들어간다.** 100토큰 이내로 유지할 것 (T-404).
 * 툴 description이 "무엇을"이라면 여기는 "어떤 순서로"다.
 */
export const INSTRUCTIONS =
  "프로젝트 문서는 여기 있다. 통째로 읽지 말 것: doc_outline → 필요한 섹션만 doc_get(heading). " +
  "재조회는 if_none_match에 직전 sha. [stale]이면 doc_changes_since. " +
  "쓰기는 doc_put — base_sha는 직전 sha, 섹션만 고칠 땐 heading에 그 섹션 전체.";

export const TOOLS = [
  {
    name: "doc_outline",
    description:
      "문서 목록과 ## 헤딩 (스펙·ADR·런북·회의록 등). 먼저 부른다. library 생략 = 접근 가능한 전체.",
    inputSchema: {
      type: "object",
      properties: {
        library: { type: "string", description: "라이브러리 slug. 생략하면 전체" },
        depth: {
          type: "string",
          enum: ["libraries", "documents"],
          description: "libraries = 라이브러리 목록만(이름·GitHub 레포·문서 수). 기본은 documents",
        },
      },
    },
  },
  {
    name: "doc_get",
    description:
      "문서 전체 또는 heading의 ## 섹션 하나. if_none_match에 직전 sha를 주면 안 바뀐 경우 unchanged만 온다.",
    inputSchema: {
      type: "object",
      properties: {
        library: { type: "string" },
        path: { type: "string", description: "라이브러리 루트 기준 경로" },
        heading: { type: "string", description: "## 섹션 제목" },
        if_none_match: { type: "string", description: "직전에 받은 sha" },
      },
      required: ["library", "path"],
    },
  },
  {
    name: "doc_search",
    description: "본문 검색, 매칭 섹션 상위 몇 개. 어느 문서에 있는지 모를 때.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, library: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "doc_changes_since",
    description: "커서 이후의 변경 요약. 인자 없이 부르면 커서를 전진시킨다.",
    inputSchema: {
      type: "object",
      properties: {
        library: { type: "string" },
        since: { type: "number", description: "이벤트 id. 주면 커서를 움직이지 않는다" },
      },
    },
  },
  {
    name: "doc_put",
    description:
      "문서 생성·수정. 새 경로면 그대로 새 문서가 된다. 기존 문서는 base_sha 필수 — 그 사이 남이 고쳤으면 거부하고 현재 sha를 준다. heading을 주면 그 섹션만 교체된다.",
    inputSchema: {
      type: "object",
      properties: {
        library: { type: "string" },
        path: { type: "string", description: ".md 로 끝나는 경로" },
        content: { type: "string", description: "문서 전체. heading을 줬으면 그 섹션 전체(## 줄 포함)" },
        heading: { type: "string", description: "이 ## 섹션만 교체. 문서 전체를 보내지 않아도 된다" },
        base_sha: { type: "string", description: "직전 doc_get의 sha. 새 문서면 생략" },
        note: { type: "string", description: "무엇을 왜 바꿨는지 한 줄" },
      },
      required: ["library", "path", "content"],
    },
  },
  {
    name: "doc_delete",
    description: "삭제. base_sha 필수. 이전 본문은 이력에 남는다.",
    inputSchema: {
      type: "object",
      properties: {
        library: { type: "string" },
        path: { type: "string" },
        base_sha: { type: "string" },
        note: { type: "string" },
      },
      required: ["library", "path", "base_sha"],
    },
  },
  {
    name: "library_create",
    description:
      "새 라이브러리(문서 묶음)를 만든다. 부른 토큰의 주인이 첫 멤버가 된다. 넣을 곳이 없을 때만.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "소문자·숫자·하이픈. URL에 쓰인다" },
        name: { type: "string", description: "사람이 읽는 이름" },
        github_repos: {
          type: "array",
          items: { type: "string" },
          description: "이 라이브러리를 보는 GitHub 레포. 'org/repo' 또는 조직 전체면 'org/*'",
        },
      },
      required: ["slug", "name"],
    },
  },
] as const;

export interface ToolResult {
  text: string;
  isError?: boolean;
  /** isError일 때 HTTP 의미의 상태. request_logs의 필터 축이다 (D-020). 없으면 400으로 기록된다 */
  status?: number;
}

/** lib/document.ts·lib/library.ts의 실패 code → HTTP 의미의 상태 */
const ERROR_STATUS: Record<string, number> = {
  invalid: 400,
  not_found: 404,
  duplicate: 409,
  conflict: 409,
  failed: 500,
};

interface LibraryState {
  latest: number;
  cursor: number;
  latestPaths: string[];
}

export interface McpContext {
  identity: TokenIdentity;
  repos: Library[];
  state: Map<string, LibraryState>;
}

// ─── 컨텍스트 ────────────────────────────────────────────────────────

export async function buildContext(identity: TokenIdentity): Promise<McpContext> {
  // admin 토큰이어도 예외 없다 — MCP는 /admin·내보내기가 아니다 (SPEC §6).
  const repos = await getMemberLibraries(identity.email);
  const state = new Map<string, LibraryState>();
  if (repos.length === 0) return { identity, repos, state };

  const { data, error } = await supabase
    .from("token_cursors")
    .select("library_id, last_event_id")
    .eq("token_id", identity.id);
  if (error) console.error("mcp: cursors", error);

  const stored = new Map<string, number>(
    (data ?? []).map((row: { library_id: string; last_event_id: number }) => [
      row.library_id,
      Number(row.last_event_id),
    ]),
  );

  // 최신 이벤트 id는 레포 행에 비정규화돼 있어(D-012) 여기서 sync_events를 두드리지 않는다.
  for (const repo of repos) {
    state.set(repo.id, {
      latest: repo.latest_event_id,
      // 처음 붙은 토큰은 "지금부터"로 시작한다. 안 그러면 첫 호출부터 [stale]이 붙는데,
      // 방금 목차를 읽은 에이전트에게 그 줄은 거짓말이고 그냥 토큰 낭비다.
      cursor: stored.get(repo.id) ?? repo.latest_event_id,
      latestPaths: [],
    });
  }

  // [stale]에 실을 경로는 뒤처진 레포가 있을 때만 조회한다 — 최신 상태가 대부분이므로
  // 이 쿼리는 평소에 아예 나가지 않는다. latest_event_id가 곧 이벤트 id라 정확히 집는다.
  const behindIds = repos
    .filter((repo) => (stored.get(repo.id) ?? repo.latest_event_id) < repo.latest_event_id)
    .map((repo) => repo.latest_event_id);
  if (behindIds.length > 0) {
    const { data: events, error: eventsError } = await supabase
      .from("sync_events")
      .select("id, library_id, changed_paths, deleted_paths")
      .in("id", behindIds);
    if (eventsError) console.error("mcp: stale paths", eventsError);
    for (const event of events ?? []) {
      const entry = state.get(event.library_id as string);
      if (entry) {
        entry.latestPaths = [...(event.changed_paths ?? []), ...(event.deleted_paths ?? [])];
      }
    }
  }

  const missing = repos.filter((repo) => !stored.has(repo.id));
  if (missing.length > 0) {
    const { error: seedError } = await supabase.from("token_cursors").upsert(
      missing.map((repo) => ({
        token_id: identity.id,
        library_id: repo.id,
        last_event_id: state.get(repo.id)?.cursor ?? 0,
      })),
      { onConflict: "token_id,library_id" },
    );
    if (seedError) console.error("mcp: cursor seed", seedError);
  }

  return { identity, repos, state };
}

/**
 * 밀렸을 때만 한 줄. 안 밀렸으면 아예 없다 → 구독 비용 0 (D-005).
 * 폴링도 열린 커넥션도 없이 "항상 최신"을 푸는 자리가 여기다.
 */
export function staleLine(context: McpContext): string | null {
  const behind = context.repos.filter((repo) => {
    const state = context.state.get(repo.id);
    return state !== undefined && state.cursor < state.latest;
  });
  if (behind.length === 0) return null;

  const parts = behind.map((repo) => {
    const paths = (context.state.get(repo.id)?.latestPaths ?? []).slice(0, 3);
    return `${repo.slug}${paths.length ? `: ${paths.join(", ")}` : ""}`;
  });
  return `[stale] ${parts.join(" / ")} changed — call doc_changes_since`;
}

// ─── 툴 ──────────────────────────────────────────────────────────────

export const outlineArgs = z.object({
  library: z.string().optional(),
  depth: z.enum(["libraries", "documents"]).optional(),
});
// 형태 검증은 createLibrarySchema가 한다 — 여기서 또 규칙을 쓰면 두 곳이 어긋난다.
export const createArgs = z.object({
  slug: z.string(),
  name: z.string(),
  // 스키마가 문자열을 나누므로 배열이 오면 합쳐서 넘긴다 — 검증 규칙은 한 곳뿐이다
  github_repos: z.array(z.string()).optional(),
});
export const getArgs = z.object({
  library: z.string(),
  path: z.string(),
  heading: z.string().optional(),
  if_none_match: z.string().optional(),
});
export const searchArgs = z.object({ query: z.string().min(1), library: z.string().optional() });
export const changesArgs = z.object({ library: z.string().optional(), since: z.number().int().optional() });


/** 접근 불가와 존재하지 않음을 구분하지 않는다 — 구분하면 레포의 존재가 새어 나간다. */
function librariesFor(context: McpContext, slug?: string): Library[] {
  return slug ? context.repos.filter((repo) => repo.slug === slug) : context.repos;
}

interface DocRow {
  library_id: string;
  path: string;
  title: string | null;
  content: string;
  content_sha: string;
}

/**
 * ponytail: 헤딩만 필요할 때도 content를 통째로 읽는다. 헤딩 컬럼을 따로 두면 sync가
 * 그걸 갱신해야 하고 드리프트가 하나 더 는다. 문서 수백 개가 되면 그때 넣는다.
 */
async function documentsOf(repos: Library[], path?: string): Promise<DocRow[]> {
  if (repos.length === 0) return [];
  let query = supabase
    .from("documents")
    .select("library_id, path, title, content, content_sha")
    .in(
      "library_id",
      repos.map((repo) => repo.id),
    )
    .order("path");
  if (path) query = query.eq("path", path);

  const { data, error } = await query;
  if (error) {
    console.error("mcp: documents", error);
    return [];
  }
  return data ?? [];
}

export async function callTool(
  context: McpContext,
  name: string,
  rawArgs: unknown,
): Promise<ToolResult> {
  switch (name) {
    case "doc_outline":
      return docOutline(context, rawArgs);
    case "doc_get":
      return docGet(context, rawArgs);
    case "doc_search":
      return docSearch(context, rawArgs);
    case "doc_changes_since":
      return docChangesSince(context, rawArgs);
    case "doc_put":
      return docPut(context, rawArgs);
    case "doc_delete":
      return docDelete(context, rawArgs);
    case "library_create":
      return libraryCreate(context, rawArgs);
    default:
      return { text: `그런 툴이 없다: ${name}`, isError: true, status: 404 };
  }
}

function badArgs(issue: string): ToolResult {
  return { text: `인자가 잘못됐다: ${issue}`, isError: true, status: 400 };
}

async function docOutline(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = outlineArgs.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const repos = librariesFor(context, args.data.library);
  if (repos.length === 0) {
    // "오타 난 slug"와 "레포가 하나도 없음"을 구분한다. 뭉뚱그리면 오타 하나에
    // 에이전트가 library_create를 불러 중복 레포를 만든다.
    return args.data.library
      ? { text: `그런 라이브러리가 없다: ${args.data.library}`, isError: true, status: 404 }
      : { text: "접근 가능한 라이브러리가 없다. library_create로 만들 수 있다." };
  }

  // depth=libraries는 "어디에 넣을까 / 이 코드 레포는 어느 라이브러리를 보나"에 답한다.
  // 본문도 헤딩도 읽지 않으므로 라이브러리가 늘어도 응답이 거의 안 자란다.
  if (args.data.depth === "libraries") {
    const { data, error } = await supabase
      .from("documents")
      .select("library_id")
      .in("library_id", repos.map((library) => library.id));
    if (error) console.error("mcp: outline counts", error);

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      counts.set(row.library_id, (counts.get(row.library_id) ?? 0) + 1);
    }
    return {
      text: repos
        .map((library) => {
          const github = library.github_repos.length ? ` (${library.github_repos.join(", ")})` : "";
          return `${library.slug} — ${library.name}${github} · 문서 ${counts.get(library.id) ?? 0}`;
        })
        .join("\n"),
    };
  }

  const docs = await documentsOf(repos);
  const byRepo = new Map(repos.map((repo) => [repo.id, [] as DocRow[]]));
  for (const doc of docs) byRepo.get(doc.library_id)?.push(doc);

  const lines: string[] = [];
  for (const repo of repos) {
    const own = byRepo.get(repo.id) ?? [];
    // 빈 레포도 한 줄로 알린다. 안 그러면 방금 만든 레포가 목록에서 사라져
    // "생성이 실패했나"로 읽힌다 — library_create 직후가 정확히 그 상황이다.
    if (own.length === 0) {
      lines.push(`${repo.slug}/ — 문서 없음`);
      continue;
    }
    for (const doc of own) {
      lines.push(`${repo.slug}/${doc.path}${doc.title ? ` — ${doc.title}` : ""}`);
      for (const heading of headings(doc.content)) lines.push(`  ## ${heading}`);
    }
  }
  return { text: lines.join("\n") };
}

async function docGet(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = getArgs.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const [library] = librariesFor(context, args.data.library);
  if (!library)
    return { text: `그런 라이브러리가 없다: ${args.data.library}`, isError: true, status: 404 };

  const [doc] = await documentsOf([library], args.data.path);
  if (!doc) return { text: `그런 문서가 없다: ${args.data.path}`, isError: true, status: 404 };

  // 해시가 같으면 본문 대신 5토큰. doc_get 재호출의 대부분이 여기서 끝난다.
  if (args.data.if_none_match && args.data.if_none_match === doc.content_sha) {
    return { text: "unchanged" };
  }

  const body = args.data.heading ? findSection(doc.content, args.data.heading) : doc.content;
  if (body === null)
    return { text: `그런 섹션이 없다: ${args.data.heading}`, isError: true, status: 404 };

  return { text: `${library.slug}/${doc.path} sha:${doc.content_sha}\n\n${body}` };
}

const SEARCH_LIMIT = 5;

async function docSearch(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = searchArgs.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const repos = librariesFor(context, args.data.library);
  const bySlug = new Map(repos.map((repo) => [repo.id, repo.slug]));
  const query = args.data.query;

  const hits: { score: number; label: string; text: string }[] = [];
  for (const doc of await documentsOf(repos)) {
    for (const section of splitSections(doc.content)) {
      const score = scoreSection(section, query);
      if (score > 0) {
        hits.push({
          score,
          label: `${bySlug.get(doc.library_id)}/${doc.path}${
            section.heading ? ` ## ${section.heading}` : ""
          }`,
          // 헤딩은 라벨에 이미 있다. 스니펫에서 다시 싣지 않는다.
          text: snippet(section.text.replace(/^##[^\n]*\n?/, ""), query),
        });
      }
    }
  }

  if (hits.length === 0) return { text: `매칭 없음: ${query}` };
  hits.sort((a, b) => b.score - a.score);

  return {
    text: hits
      .slice(0, SEARCH_LIMIT)
      .map((hit) => `${hit.label}\n  ${hit.text}`)
      .join("\n"),
  };
}

const CHANGES_LIMIT = 20;

/**
 * 레포 생성. 토큰이 이미 이메일까지 해석됐으므로 그게 곧 신원이다 (D-013: 로그인이면 누구나).
 * 생성 로직은 웹 폼과 같은 lib/repository.ts를 지난다 — 두 벌이면 한쪽만 어긋난다.
 *
 * 새 레포는 이 요청의 컨텍스트에 없다. 그래서 다음 툴 호출부터 보인다고 알려 준다 —
 * 안 그러면 에이전트가 바로 doc_put을 부르고 "그런 라이브러리가 없다"를 받는다.
 */
async function libraryCreate(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = createArgs.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const result = await createLibraryFor(context.identity.email, {
    ...args.data,
    github_repos: args.data.github_repos?.join(" "),
  });
  if (!result.ok)
    return { text: result.message, isError: true, status: ERROR_STATUS[result.code] };

  return {
    text: `만들었다 ${result.slug} — 멤버: ${context.identity.email}. doc_put(library:"${result.slug}", …)으로 문서를 넣는다`,
  };
}

async function docChangesSince(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = changesArgs.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const repos = librariesFor(context, args.data.library);
  const blocks: string[] = [];

  for (const repo of repos) {
    const state = context.state.get(repo.id);
    if (!state) continue;

    const from = args.data.since ?? state.cursor;
    const { data, error } = await supabase
      .from("sync_events")
      .select("id, summary")
      .eq("library_id", repo.id)
      .gt("id", from)
      .order("id")
      .limit(CHANGES_LIMIT);

    if (error) {
      console.error("mcp: changes", error);
      continue;
    }
    const events = data ?? [];
    if (events.length === 0) continue;

    for (const event of events) {
      blocks.push(`[${event.id}] ${repo.slug}\n${event.summary ?? ""}`.trimEnd());
    }

    // since를 명시했으면 임의 조회다 — 커서를 움직이지 않는다 (SPEC §7).
    // 잘렸을 수 있으니 실제로 준 마지막 id까지만 전진시킨다.
    if (args.data.since === undefined) {
      const advanced = Number(events[events.length - 1].id);
      state.cursor = advanced;
      const { error: cursorError } = await supabase.from("token_cursors").upsert(
        {
          token_id: context.identity.id,
          library_id: repo.id,
          last_event_id: advanced,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token_id,library_id" },
      );
      if (cursorError) console.error("mcp: cursor advance", cursorError);
    }
  }

  return { text: blocks.length > 0 ? blocks.join("\n\n") : "변경 없음" };
}

// ─── 쓰기 ────────────────────────────────────────────────────────────

/** 방금 내가 만든 이벤트는 이미 본 것으로 친다. `advanceCursor`의 메모리 쪽 짝. */
function markSeen(context: McpContext, libraryId: string, eventId: number | null): void {
  const state = context.state.get(libraryId);
  if (!state || eventId === null) return;
  state.latest = Math.max(state.latest, eventId);
  state.cursor = state.latest;
}

/**
 * 충돌은 에러로 돌려주되 **현재 sha를 같이 준다.** 그래야 에이전트가 사람을 부르지 않고
 * doc_get → 다시 편집 → doc_put 으로 스스로 회복한다.
 */
async function docPut(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = putDocumentSchema.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const result = await putDocument({
    email: context.identity.email,
    repo: args.data.library,
    path: args.data.path,
    content: args.data.content,
    heading: args.data.heading,
    baseSha: args.data.base_sha,
    note: args.data.note,
    tokenId: context.identity.id,
  });

  if (!result.ok) {
    const current = result.currentSha ? ` 현재 sha:${result.currentSha}` : "";
    return { text: `${result.message}${current}`, isError: true, status: ERROR_STATUS[result.code] };
  }
  // DB뿐 아니라 이번 요청의 컨텍스트도 밀어 준다 — 안 그러면 방금 쓴 응답에 [stale]이 붙는다
  markSeen(context, result.libraryId, result.eventId);
  return { text: `저장했다 ${args.data.library}/${args.data.path} sha:${result.sha}` };
}

async function docDelete(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = deleteDocumentSchema.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const result = await deleteDocument({
    email: context.identity.email,
    repo: args.data.library,
    path: args.data.path,
    baseSha: args.data.base_sha,
    note: args.data.note,
    tokenId: context.identity.id,
  });

  if (!result.ok) {
    const current = result.currentSha ? ` 현재 sha:${result.currentSha}` : "";
    return { text: `${result.message}${current}`, isError: true, status: ERROR_STATUS[result.code] };
  }
  markSeen(context, result.libraryId, result.eventId);
  return { text: `지웠다 ${args.data.library}/${args.data.path}` };
}
