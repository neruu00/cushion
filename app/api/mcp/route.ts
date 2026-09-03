/**
 * @file app/api/mcp/route.ts
 * @description Streamable HTTP MCP 엔드포인트 (T-401). Bearer = access token(`cshn_pat_`).
 *
 * SDK를 넣지 않는다. 이 서버는 상태가 없고(세션 없음, SSE 없음) 읽기 툴 4개뿐이라
 * 실제로 필요한 건 POST 하나에 JSON-RPC 2.0을 태우는 것뿐이다 — 그게 아래 전부다.
 * 서버가 먼저 말을 걸어야 할 일이 생기면 그때 SSE와 함께 SDK를 검토한다.
 *
 * 권한은 요청마다 다시 조회한다(`buildContext` → `getAccessibleLibraries`).
 * 토큰에 권한을 굽지 않으므로 멤버에서 빼면 다음 호출부터 바로 막힌다. (SPEC §6)
 *
 * 요청마다 request_logs에 한 줄 남긴다 (D-020). JSON-RPC 에러는 HTTP로는 200이지만
 * 로그의 status에는 의미상의 상태(400·404·409·500)를 적는다 — /admin의 필터 축이 그거다.
 */
import type { NextRequest } from "next/server";

import { identityFromAccessToken } from "@/lib/authz";
import { recordRequestLog } from "@/lib/logs.db";
import { buildContext, callTool, INSTRUCTIONS, SERVER_INFO, staleLine, TOOLS } from "@/lib/mcp";
import { recordUsage } from "@/lib/usage.db";

/** 우리가 쓰는 표면(initialize/tools.*)은 이 리비전들에서 동일하다. */
const DEFAULT_PROTOCOL = "2025-06-18";

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

/** 처리 중에 채워 나가는 로그 초안. 어디서 끊겨도 그때까지 채운 만큼은 남는다. */
interface LogDraft {
  method: string | null;
  tool: string | null;
  library: string | null;
  actor: string | null;
  status: number;
  error: string | null;
}

function rpcResult(id: string | number | null, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: string | number | null, code: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function POST(request: NextRequest): Promise<Response> {
  const started = Date.now();
  const log: LogDraft = {
    method: null,
    tool: null,
    library: null,
    actor: null,
    status: 200,
    error: null,
  };

  let response: Response;
  try {
    response = await handle(request, log);
  } catch (error) {
    // 여기까지 온 예외는 툴이 못 접은 것이다. 요청은 500으로 답하고 로그에 원문을 남긴다.
    console.error("mcp:", error);
    log.status = 500;
    log.error = error instanceof Error ? error.message : String(error);
    response = Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: "internal error" } },
      { status: 500 },
    );
  }

  // 기록 실패는 recordRequestLog가 삼킨다 — 로그 때문에 요청을 깨뜨리지 않는다 (fail-open)
  await recordRequestLog({ ...log, durationMs: Date.now() - started });
  return response;
}

async function handle(request: NextRequest, log: LogDraft): Promise<Response> {
  const identity = await identityFromAccessToken(request.headers.get("authorization"));
  if (!identity) {
    log.status = 401;
    log.error = "unauthorized";
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized" } },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="cushion"' } },
    );
  }
  log.actor = identity.email;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    log.status = 400;
    log.error = "parse error";
    return rpcError(null, -32700, "parse error");
  }

  // 2025-06-18에서 JSON-RPC 배치가 빠졌다. 단건만 받는다.
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    log.status = 400;
    log.error = "invalid request";
    return rpcError(null, -32600, "invalid request");
  }

  const message = body as JsonRpcRequest;
  const id = message.id ?? null;
  log.method = message.method ?? null;

  // id가 없으면 notification이다 — 응답 본문을 만들지 않는다.
  if (message.id === undefined) {
    log.status = 202;
    return new Response(null, { status: 202 });
  }

  switch (message.method) {
    case "initialize": {
      const requested = message.params?.protocolVersion;
      return rpcResult(id, {
        // 클라이언트가 부른 리비전을 그대로 받는다. 우리 표면이 그 사이에서 안 바뀌기 때문이다.
        protocolVersion: typeof requested === "string" ? requested : DEFAULT_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    case "tools/call": {
      const name = message.params?.name;
      if (typeof name !== "string") {
        log.status = 400;
        log.error = "tool name required";
        return rpcError(id, -32602, "tool name required");
      }
      log.tool = name;

      // 외부 입력이라 단언하지 않고 좁힌다. 여기서 필요한 건 slug 하나뿐이라
      // Zod를 한 벌 더 두지 않는다 — 인자 검증은 callTool 안에서 이미 했다.
      const args = message.params?.arguments;
      const slug =
        typeof args === "object" && args !== null && "library" in args &&
        typeof args.library === "string"
          ? args.library
          : null;
      log.library = slug;

      const context = await buildContext(identity);
      const result = await callTool(context, name, args);
      if (result.isError) {
        log.status = result.status ?? 400;
        log.error = result.text;
      }

      // 밀렸을 때만 한 줄 얹는다. 안 밀렸으면 아무것도 붙지 않는다 → 구독 비용 0 (D-005).
      const stale = staleLine(context);
      const text = stale ? `${result.text}\n\n${stale}` : result.text;

      // 호출 수 기록. 여기가 유일한 지점이다 — 툴 하나하나에 흩으면 새 툴을 추가할 때
      // 빠뜨린다.
      //
      // 라이브러리로 귀속되는 호출만 센다. library 인자가 없는 doc_outline은 접근 가능한
      // 전 라이브러리를 훑으므로 어느 하나에 달 수가 없고, 억지로 달면 그 라이브러리의
      // 숫자가 부풀어 오른다. 그만큼 과소집계된다는 건 화면이 밝힌다.
      const target = slug ? context.repos.find((repo) => repo.slug === slug) : undefined;
      if (target) await recordUsage({ libraryId: target.id, tool: name });

      return rpcResult(id, {
        content: [{ type: "text", text }],
        ...(result.isError ? { isError: true } : {}),
      });
    }

    default:
      log.status = 400;
      log.error = `method not found: ${message.method}`;
      return rpcError(id, -32601, `method not found: ${message.method}`);
  }
}

/** 서버가 먼저 보내는 스트림을 열지 않는다. 스펙상 이 경우 405다. */
export function GET(): Response {
  return new Response("method not allowed", { status: 405, headers: { Allow: "POST" } });
}

/** 세션을 들지 않으므로 종료할 것도 없다. */
export function DELETE(): Response {
  return new Response("method not allowed", { status: 405, headers: { Allow: "POST" } });
}
