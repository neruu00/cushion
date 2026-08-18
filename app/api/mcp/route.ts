/**
 * @file app/api/mcp/route.ts
 * @description Vercel mcp-handler 기반의 MCP 엔드포인트.
 * 
 * SSE와 Streamable HTTP를 모두 지원하며, Antigravity, Claude Code, Cursor 등 다양한 
 * MCP 클라이언트와 완벽하게 호환됩니다.
 * 
 * 각 툴의 권한 검사는 `headers()`를 통해 요청 시마다 이루어집니다.
 */
import { headers } from "next/headers";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

import { identityFromAccessToken, type TokenIdentity } from "@/lib/authz";
import { recordRequestLog } from "@/lib/logs.db";
import { buildContext, callTool, SERVER_INFO, staleLine, type McpContext } from "@/lib/mcp";
import { outlineArgs, getArgs, searchArgs, changesArgs, createArgs } from "@/lib/mcp";
import { putDocumentSchema, deleteDocumentSchema } from "@/lib/document.schema";
import { recordUsage } from "@/lib/usage.db";

/** 공통 인증 로직: 헤더에서 토큰을 추출해 컨텍스트를 구성합니다. */
async function getAuthContext(): Promise<{ identity: TokenIdentity; context: McpContext }> {
  const reqHeaders = await headers();
  const authHeader = reqHeaders.get("authorization");
  const identity = await identityFromAccessToken(authHeader);
  if (!identity) {
    throw new Error("unauthorized");
  }
  const context = await buildContext(identity);
  return { identity, context };
}

/** 툴 실행 후 사용량과 [stale] 커서를 처리하는 헬퍼 */
async function processToolResult(
  name: string,
  args: Record<string, unknown>,
  context: McpContext,
  resultText: string
): Promise<string> {
  const slug = args.library as string | undefined;
  const target = slug ? context.repos.find((repo) => repo.slug === slug) : undefined;
  
  const stale = staleLine(context);
  const text = stale ? `${resultText}\n\n${stale}` : resultText;

  if (target) {
    await recordUsage({
      libraryId: target.id,
      tool: name,
      inChars: JSON.stringify(args ?? {}).length,
      outChars: text.length,
    });
  }
  return text;
}

const handler = createMcpHandler((rawServer) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server = rawServer as any;
  server.tool(
    "doc_outline",
    "문서 목록과 ## 헤딩 (스펙·ADR·런북·회의록 등). 먼저 부른다. library 생략 = 접근 가능한 전체.",
    outlineArgs.shape,
    async (args: unknown) => {
      const { context } = await getAuthContext();
      const res = await callTool(context, "doc_outline", args);
      if (res.isError) throw new Error(res.text);
      const text = await processToolResult("doc_outline", args as Record<string, unknown>, context, res.text);
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "doc_get",
    "문서 전체 또는 heading의 ## 섹션 하나. if_none_match에 직전 sha를 주면 안 바뀐 경우 unchanged만 온다.",
    getArgs.shape,
    async (args: unknown) => {
      const { context } = await getAuthContext();
      const res = await callTool(context, "doc_get", args);
      if (res.isError) throw new Error(res.text);
      const text = await processToolResult("doc_get", args as Record<string, unknown>, context, res.text);
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "doc_search",
    "본문 검색, 매칭 섹션 상위 몇 개. 어느 문서에 있는지 모를 때.",
    searchArgs.shape,
    async (args: unknown) => {
      const { context } = await getAuthContext();
      const res = await callTool(context, "doc_search", args);
      if (res.isError) throw new Error(res.text);
      const text = await processToolResult("doc_search", args as Record<string, unknown>, context, res.text);
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "doc_changes_since",
    "커서 이후의 변경 요약. 인자 없이 부르면 커서를 전진시킨다.",
    changesArgs.shape,
    async (args: unknown) => {
      const { context } = await getAuthContext();
      const res = await callTool(context, "doc_changes_since", args);
      if (res.isError) throw new Error(res.text);
      const text = await processToolResult("doc_changes_since", args as Record<string, unknown>, context, res.text);
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "doc_put",
    "문서 생성·수정. 새 경로면 그대로 새 문서가 된다. 기존 문서는 base_sha 필수 — 그 사이 남이 고쳤으면 거부하고 현재 sha를 준다. heading을 주면 그 섹션만 교체된다.",
    putDocumentSchema.shape,
    async (args: unknown) => {
      const { context } = await getAuthContext();
      const res = await callTool(context, "doc_put", args);
      if (res.isError) throw new Error(res.text);
      const text = await processToolResult("doc_put", args as Record<string, unknown>, context, res.text);
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "doc_delete",
    "삭제. base_sha 필수. 이전 본문은 이력에 남는다.",
    deleteDocumentSchema.shape,
    async (args: unknown) => {
      const { context } = await getAuthContext();
      const res = await callTool(context, "doc_delete", args);
      if (res.isError) throw new Error(res.text);
      const text = await processToolResult("doc_delete", args as Record<string, unknown>, context, res.text);
      return { content: [{ type: "text", text }] };
    }
  );

  server.tool(
    "library_create",
    "새 라이브러리(문서 묶음)를 만든다. 부른 토큰의 주인이 첫 멤버가 된다. 넣을 곳이 없을 때만.",
    createArgs.shape,
    async (args: unknown) => {
      const { context } = await getAuthContext();
      const res = await callTool(context, "library_create", args);
      if (res.isError) throw new Error(res.text);
      const text = await processToolResult("library_create", args as Record<string, unknown>, context, res.text);
      return { content: [{ type: "text", text }] };
    }
  );

}, {
  serverInfo: SERVER_INFO,
  onEvent: (event) => {
    if (event.type === "REQUEST_COMPLETED" || event.type === "ERROR") {
      const e = event as unknown as Record<string, unknown>;
      const parameters = e.parameters as Record<string, unknown> | undefined;
      const args = parameters?.arguments as Record<string, unknown> | undefined;
      
      const log = {
        method: typeof e.method === "string" ? e.method : null,
        tool: typeof parameters?.name === "string" ? parameters.name : null,
        library: typeof args?.library === "string" ? args.library : null,
        actor: null, 
        status: event.type === "ERROR" ? 500 : 200,
        error: event.type === "ERROR" ? String(e.error) : null,
        durationMs: typeof e.duration === "number" ? e.duration : 0,
      };
      recordRequestLog(log).catch(console.error);
    }
  }
});

const verifyToken = async (req: Request, bearerToken?: string): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;
  const identity = await identityFromAccessToken(`Bearer ${bearerToken}`);
  if (!identity) return undefined;
  return {
    token: bearerToken,
    scopes: [],
    clientId: identity.email,
    extra: { userId: identity.id }
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { authHandler as GET, authHandler as POST, authHandler as OPTIONS };
