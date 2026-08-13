/**
 * @file lib/mcp.ts
 * @description MCP 툴 4종과 구독 커서 (T-402, T-403, T-404). 전송 계층은 app/api/mcp/route.ts.
 *
 * **원본이 여기 있으므로 쓰기 툴이 있다** (D-011). 그래서 유출된 PAT는 열람뿐 아니라
 * 훼손도 할 수 있다 — 복구 근거는 `document_versions`뿐이다. (SPEC §6)
 *
 * 절감의 본체가 여기다: 목차 먼저(spec_outline) → 필요한 섹션만(spec_get) →
 * 안 바뀌었으면 본문 대신 5토큰(if_none_match) → 밀렸을 때만 한 줄([stale]).
 */
import { z } from "zod";

import { getAccessibleRepos, type Repo, type TokenIdentity } from "@/lib/authz";
import { deleteDocument, putDocument } from "@/lib/document";
import { deleteDocumentSchema, putDocumentSchema } from "@/lib/document.schema";
import { findSection, headings, scoreSection, snippet, splitSections } from "@/lib/spec";
import { supabase } from "@/lib/supabase";

export const SERVER_INFO = { name: "cushion", version: "0.1.0" } as const;

/**
 * `initialize` 응답에 실려 **매 세션 컨텍스트에 들어간다.** 100토큰 이내로 유지할 것 (T-404).
 * 툴 description이 "무엇을"이라면 여기는 "어떤 순서로"다.
 */
export const INSTRUCTIONS =
  "스펙 파일을 통째로 읽지 말 것. spec_outline으로 목차를 본 뒤 필요한 섹션만 spec_get(heading). " +
  "재조회는 if_none_match에 직전 sha. 응답 끝에 [stale]이 있으면 spec_changes_since. " +
  "고칠 땐 spec_get으로 받은 sha를 spec_put의 base_sha에 그대로 넘긴다.";

export const TOOLS = [
  {
    name: "spec_outline",
    description:
      "문서 목록과 각 문서의 ## 헤딩만 반환한다. 스펙을 읽기 전에 먼저 부른다. repo를 생략하면 접근 가능한 전체 레포를 한 번에 본다.",
    inputSchema: {
      type: "object",
      properties: { repo: { type: "string", description: "레포 slug. 생략하면 전체" } },
    },
  },
  {
    name: "spec_get",
    description:
      "문서 하나, 또는 heading을 주면 그 ## 섹션만 반환한다. if_none_match에 직전 응답의 sha를 넣으면 안 바뀐 경우 본문 대신 unchanged만 온다.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        path: { type: "string", description: "레포 루트 기준 경로" },
        heading: { type: "string", description: "## 섹션 제목" },
        if_none_match: { type: "string", description: "직전에 받은 sha" },
      },
      required: ["repo", "path"],
    },
  },
  {
    name: "spec_search",
    description: "스펙 본문을 검색해 매칭된 섹션 상위 몇 개를 반환한다. 어느 문서에 있는지 모를 때 쓴다.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, repo: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "spec_changes_since",
    description:
      "마지막으로 확인한 이후의 스펙 변경 요약. 인자 없이 부르면 저장된 커서 이후를 주고 커서를 전진시킨다.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        since: { type: "number", description: "이벤트 id. 주면 커서를 움직이지 않는다" },
      },
    },
  },
  {
    name: "spec_put",
    description:
      "문서를 만들거나 고친다. 고칠 때는 spec_get으로 받은 sha를 base_sha에 넣어야 한다 — 그 사이 남이 고쳤으면 거부되고 현재 sha를 돌려준다. 새 문서면 base_sha를 생략한다. 내용은 전체를 보낸다(부분 수정 아님).",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        path: { type: "string", description: "레포 루트 기준 경로. .md 로 끝나야 한다" },
        content: { type: "string", description: "문서 전체 내용" },
        base_sha: { type: "string", description: "직전 spec_get의 sha. 새 문서면 생략" },
        note: { type: "string", description: "무엇을 왜 바꿨는지 한 줄" },
      },
      required: ["repo", "path", "content"],
    },
  },
  {
    name: "spec_delete",
    description: "문서를 지운다. base_sha가 필요하다. 이전 본문은 이력에 남아 되돌릴 수 있다.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string" },
        path: { type: "string" },
        base_sha: { type: "string" },
        note: { type: "string" },
      },
      required: ["repo", "path", "base_sha"],
    },
  },
] as const;

export interface ToolResult {
  text: string;
  isError?: boolean;
}

interface RepoState {
  latest: number;
  cursor: number;
  latestPaths: string[];
}

export interface McpContext {
  identity: TokenIdentity;
  repos: Repo[];
  state: Map<string, RepoState>;
}

// ─── 컨텍스트 ────────────────────────────────────────────────────────

/**
 * ponytail: 최신 이벤트를 레포 수만큼 조회한다. `sync_events(repository_id, id desc)` 인덱스를
 * 그대로 타므로 레포 몇 개 규모에선 문제없다. 수십 개를 넘으면 max(id) 뷰를 판다.
 */
async function latestEvent(repositoryId: string): Promise<{ id: number; paths: string[] }> {
  const { data, error } = await supabase
    .from("sync_events")
    .select("id, changed_paths, deleted_paths")
    .eq("repository_id", repositoryId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) console.error("mcp: latestEvent", error);
  if (!data) return { id: 0, paths: [] };
  return {
    id: Number(data.id),
    paths: [...(data.changed_paths ?? []), ...(data.deleted_paths ?? [])],
  };
}

export async function buildContext(identity: TokenIdentity): Promise<McpContext> {
  const repos = await getAccessibleRepos(identity.email);
  const state = new Map<string, RepoState>();
  if (repos.length === 0) return { identity, repos, state };

  const latest = await Promise.all(repos.map((repo) => latestEvent(repo.id)));

  const { data, error } = await supabase
    .from("token_cursors")
    .select("repository_id, last_event_id")
    .eq("token_id", identity.id);
  if (error) console.error("mcp: cursors", error);

  const stored = new Map<string, number>(
    (data ?? []).map((row: { repository_id: string; last_event_id: number }) => [
      row.repository_id,
      Number(row.last_event_id),
    ]),
  );

  repos.forEach((repo, index) => {
    state.set(repo.id, {
      latest: latest[index].id,
      // 처음 붙은 토큰은 "지금부터"로 시작한다. 안 그러면 첫 호출부터 [stale]이 붙는데,
      // 방금 목차를 읽은 에이전트에게 그 줄은 거짓말이고 그냥 토큰 낭비다.
      cursor: stored.get(repo.id) ?? latest[index].id,
      latestPaths: latest[index].paths,
    });
  });

  const missing = repos.filter((repo) => !stored.has(repo.id));
  if (missing.length > 0) {
    const { error: seedError } = await supabase.from("token_cursors").upsert(
      missing.map((repo) => ({
        token_id: identity.id,
        repository_id: repo.id,
        last_event_id: state.get(repo.id)?.cursor ?? 0,
      })),
      { onConflict: "token_id,repository_id" },
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
  return `[stale] ${parts.join(" / ")} changed — call spec_changes_since`;
}

// ─── 툴 ──────────────────────────────────────────────────────────────

const outlineArgs = z.object({ repo: z.string().optional() });
const getArgs = z.object({
  repo: z.string(),
  path: z.string(),
  heading: z.string().optional(),
  if_none_match: z.string().optional(),
});
const searchArgs = z.object({ query: z.string().min(1), repo: z.string().optional() });
const changesArgs = z.object({ repo: z.string().optional(), since: z.number().int().optional() });

/** 접근 불가와 존재하지 않음을 구분하지 않는다 — 구분하면 레포의 존재가 새어 나간다. */
function reposFor(context: McpContext, slug?: string): Repo[] {
  return slug ? context.repos.filter((repo) => repo.slug === slug) : context.repos;
}

interface DocRow {
  repository_id: string;
  path: string;
  title: string | null;
  content: string;
  content_sha: string;
}

/**
 * ponytail: 헤딩만 필요할 때도 content를 통째로 읽는다. 헤딩 컬럼을 따로 두면 sync가
 * 그걸 갱신해야 하고 드리프트가 하나 더 는다. 문서 수백 개가 되면 그때 넣는다.
 */
async function documentsOf(repos: Repo[], path?: string): Promise<DocRow[]> {
  if (repos.length === 0) return [];
  let query = supabase
    .from("documents")
    .select("repository_id, path, title, content, content_sha")
    .in(
      "repository_id",
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
    case "spec_outline":
      return specOutline(context, rawArgs);
    case "spec_get":
      return specGet(context, rawArgs);
    case "spec_search":
      return specSearch(context, rawArgs);
    case "spec_changes_since":
      return specChangesSince(context, rawArgs);
    case "spec_put":
      return specPut(context, rawArgs);
    case "spec_delete":
      return specDelete(context, rawArgs);
    default:
      return { text: `그런 툴이 없다: ${name}`, isError: true };
  }
}

function badArgs(issue: string): ToolResult {
  return { text: `인자가 잘못됐다: ${issue}`, isError: true };
}

async function specOutline(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = outlineArgs.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const repos = reposFor(context, args.data.repo);
  const bySlug = new Map(repos.map((repo) => [repo.id, repo.slug]));
  const docs = await documentsOf(repos);
  if (docs.length === 0) return { text: "문서가 없다." };

  const lines: string[] = [];
  for (const doc of docs) {
    lines.push(
      `${bySlug.get(doc.repository_id)}/${doc.path}${doc.title ? ` — ${doc.title}` : ""}`,
    );
    for (const heading of headings(doc.content)) lines.push(`  ## ${heading}`);
  }
  return { text: lines.join("\n") };
}

async function specGet(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = getArgs.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const [repo] = reposFor(context, args.data.repo);
  if (!repo) return { text: `그런 레포가 없다: ${args.data.repo}`, isError: true };

  const [doc] = await documentsOf([repo], args.data.path);
  if (!doc) return { text: `그런 문서가 없다: ${args.data.path}`, isError: true };

  // 해시가 같으면 본문 대신 5토큰. spec_get 재호출의 대부분이 여기서 끝난다.
  if (args.data.if_none_match && args.data.if_none_match === doc.content_sha) {
    return { text: "unchanged" };
  }

  const body = args.data.heading ? findSection(doc.content, args.data.heading) : doc.content;
  if (body === null) return { text: `그런 섹션이 없다: ${args.data.heading}`, isError: true };

  return { text: `${repo.slug}/${doc.path} sha:${doc.content_sha}\n\n${body}` };
}

const SEARCH_LIMIT = 5;

async function specSearch(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = searchArgs.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const repos = reposFor(context, args.data.repo);
  const bySlug = new Map(repos.map((repo) => [repo.id, repo.slug]));
  const query = args.data.query;

  const hits: { score: number; label: string; text: string }[] = [];
  for (const doc of await documentsOf(repos)) {
    for (const section of splitSections(doc.content)) {
      const score = scoreSection(section, query);
      if (score > 0) {
        hits.push({
          score,
          label: `${bySlug.get(doc.repository_id)}/${doc.path}${
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

async function specChangesSince(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = changesArgs.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const repos = reposFor(context, args.data.repo);
  const blocks: string[] = [];

  for (const repo of repos) {
    const state = context.state.get(repo.id);
    if (!state) continue;

    const from = args.data.since ?? state.cursor;
    const { data, error } = await supabase
      .from("sync_events")
      .select("id, summary")
      .eq("repository_id", repo.id)
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
          repository_id: repo.id,
          last_event_id: advanced,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token_id,repository_id" },
      );
      if (cursorError) console.error("mcp: cursor advance", cursorError);
    }
  }

  return { text: blocks.length > 0 ? blocks.join("\n\n") : "변경 없음" };
}

// ─── 쓰기 ────────────────────────────────────────────────────────────

/** 방금 내가 만든 이벤트는 이미 본 것으로 친다. `advanceCursor`의 메모리 쪽 짝. */
function markSeen(context: McpContext, repositoryId: string, eventId: number | null): void {
  const state = context.state.get(repositoryId);
  if (!state || eventId === null) return;
  state.latest = Math.max(state.latest, eventId);
  state.cursor = state.latest;
}

/**
 * 충돌은 에러로 돌려주되 **현재 sha를 같이 준다.** 그래야 에이전트가 사람을 부르지 않고
 * spec_get → 다시 편집 → spec_put 으로 스스로 회복한다.
 */
async function specPut(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = putDocumentSchema.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const result = await putDocument({
    email: context.identity.email,
    repo: args.data.repo,
    path: args.data.path,
    content: args.data.content,
    baseSha: args.data.base_sha,
    note: args.data.note,
    tokenId: context.identity.id,
  });

  if (!result.ok) {
    const current = result.currentSha ? ` 현재 sha:${result.currentSha}` : "";
    return { text: `${result.message}${current}`, isError: true };
  }
  // DB뿐 아니라 이번 요청의 컨텍스트도 밀어 준다 — 안 그러면 방금 쓴 응답에 [stale]이 붙는다
  markSeen(context, result.repositoryId, result.eventId);
  return { text: `저장했다 ${args.data.repo}/${args.data.path} sha:${result.sha}` };
}

async function specDelete(context: McpContext, rawArgs: unknown): Promise<ToolResult> {
  const args = deleteDocumentSchema.safeParse(rawArgs ?? {});
  if (!args.success) return badArgs(args.error.issues[0].message);

  const result = await deleteDocument({
    email: context.identity.email,
    repo: args.data.repo,
    path: args.data.path,
    baseSha: args.data.base_sha,
    note: args.data.note,
    tokenId: context.identity.id,
  });

  if (!result.ok) {
    const current = result.currentSha ? ` 현재 sha:${result.currentSha}` : "";
    return { text: `${result.message}${current}`, isError: true };
  }
  markSeen(context, result.repositoryId, result.eventId);
  return { text: `지웠다 ${args.data.repo}/${args.data.path}` };
}
