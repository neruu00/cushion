/**
 * @file app/api/mcp/route.ts
 * @description Streamable HTTP MCP 엔드포인트 (T-401). Bearer = access token(`cshn_pat_`).
 *
 * SDK를 넣지 않는다. 이 서버는 상태가 없고(세션 없음, SSE 없음) 읽기 툴 4개뿐이라
 * 실제로 필요한 건 POST 하나에 JSON-RPC 2.0을 태우는 것뿐이다 — 그게 아래 전부다.
 * 서버가 먼저 말을 걸어야 할 일이 생기면 그때 SSE와 함께 SDK를 검토한다.
 *
 * 권한은 요청마다 다시 조회한다(`buildContext` → `getAccessibleRepos`).
 * 토큰에 권한을 굽지 않으므로 멤버에서 빼면 다음 호출부터 바로 막힌다. (SPEC §6)
 */
import type { NextRequest } from "next/server";

import { identityFromAccessToken } from "@/lib/authz";
import { buildContext, callTool, INSTRUCTIONS, SERVER_INFO, staleLine, TOOLS } from "@/lib/mcp";

/** 우리가 쓰는 표면(initialize/tools.*)은 이 리비전들에서 동일하다. */
const DEFAULT_PROTOCOL = "2025-06-18";

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: string | number | null, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: string | number | null, code: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function POST(request: NextRequest): Promise<Response> {
  const identity = await identityFromAccessToken(request.headers.get("authorization"));
  if (!identity) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized" } },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="cushion"' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "parse error");
  }

  // 2025-06-18에서 JSON-RPC 배치가 빠졌다. 단건만 받는다.
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return rpcError(null, -32600, "invalid request");
  }

  const message = body as JsonRpcRequest;
  const id = message.id ?? null;

  // id가 없으면 notification이다 — 응답 본문을 만들지 않는다.
  if (message.id === undefined) return new Response(null, { status: 202 });

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
      if (typeof name !== "string") return rpcError(id, -32602, "tool name required");

      const context = await buildContext(identity);
      const result = await callTool(context, name, message.params?.arguments);

      // 밀렸을 때만 한 줄 얹는다. 안 밀렸으면 아무것도 붙지 않는다 → 구독 비용 0 (D-005).
      const stale = staleLine(context);
      const text = stale ? `${result.text}\n\n${stale}` : result.text;

      return rpcResult(id, {
        content: [{ type: "text", text }],
        ...(result.isError ? { isError: true } : {}),
      });
    }

    default:
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
