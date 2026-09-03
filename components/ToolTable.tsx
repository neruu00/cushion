/**
 * @file components/ToolTable.tsx
 * @description MCP 툴 레퍼런스. **`lib/mcp.ts`의 `TOOLS`를 그대로 읽는다.**
 *
 * 손으로 옮겨 적지 않는 게 요점이다. 툴 설명은 에이전트가 실제로 받는 문자열이고,
 * 문서에 사본을 두면 툴을 고칠 때 한쪽만 고치는 날이 온다 — 그러면 이 화면이
 * 존재 이유(문서와 코드가 어긋나지 않게)를 스스로 어긴다.
 *
 * 인자도 `inputSchema`에서 뽑는다. 필수 인자는 굵게 표시한다.
 */
import { TOOLS } from "@/lib/mcp";

/**
 * `TOOLS`는 `as const`라 readonly 튜플이다. JSON Schema를 좁게 타이핑하면
 * 툴을 추가할 때마다 여기까지 손봐야 하므로, 읽을 필드만 최소로 좁힌다.
 */
interface ToolSchema {
  properties?: Record<string, { description?: string }>;
  required?: readonly string[];
}

export function ToolTable() {
  return (
    <div className="space-y-4">
      {TOOLS.map((tool) => {
        const schema = tool.inputSchema as ToolSchema;
        const required = new Set(schema.required ?? []);
        const args = Object.entries(schema.properties ?? {});

        return (
          <div key={tool.name} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <code className="font-mono text-sm font-semibold">{tool.name}</code>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </div>

            {args.length > 0 && (
              <dl className="mt-3 grid gap-x-4 gap-y-1.5 border-t pt-3 text-xs sm:grid-cols-[8rem_minmax(0,1fr)]">
                {args.map(([name, spec]) => (
                  <div key={name} className="contents">
                    <dt className="font-mono">
                      {name}
                      {required.has(name) && (
                        <span className="ml-1 text-muted-foreground" title="필수">
                          *
                        </span>
                      )}
                    </dt>
                    <dd className="text-muted-foreground">{spec.description ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        <span className="font-mono">*</span> 표시는 필수 인자를 뜻해요. 이 표는 서버가 실제로
        알리는 <code>tools/list</code> 응답에서 그대로 생성되기 때문에, 에이전트가 받는 설명과
        똑같은 문자열이에요.
      </p>
    </div>
  );
}
