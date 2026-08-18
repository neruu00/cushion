/**
 * @file lib/logs.db.ts
 * @description `request_logs` 읽기·쓰기 (D-020). /admin 모니터링이 소비한다.
 *
 * 기록은 fail-open이다 — 로그가 안 남았다고 에이전트의 요청을 깨뜨릴 이유가 없다.
 * usage.db.ts와 같은 이유로 순수 계산 없이 DB만 만진다 (D-008).
 */
import { supabase } from "./supabase";

/** PostgREST: 스키마 캐시에 테이블이 없다 = 스키마를 아직 안 돌렸다 */
const MISSING_TABLE = "PGRST205";

let migrationNoticeShown = false;

function isMissingMigration(error: { code?: string }): boolean {
  if (error.code !== MISSING_TABLE) return false;
  if (!migrationNoticeShown) {
    migrationNoticeShown = true;
    console.warn(
      "logs: supabase/migrations/0001_schema.sql 을 다시 돌려야 한다(request_logs 없음). " +
        "요청 로그는 비어 있고 나머지 기능은 정상이다.",
    );
  }
  return true;
}

export interface RequestLogInput {
  method: string | null;
  tool: string | null;
  library: string | null;
  actor: string | null;
  status: number;
  error: string | null;
  durationMs: number;
}

export interface RequestLogRow {
  id: number;
  method: string | null;
  tool: string | null;
  library: string | null;
  actor: string | null;
  status: number;
  error: string | null;
  duration_ms: number;
  created_at: string;
}

/** 요청 하나를 남긴다. 실패해도 삼킨다 (fail-open, D-020). */
export async function recordRequestLog(input: RequestLogInput): Promise<void> {
  const { error } = await supabase.from("request_logs").insert({
    method: input.method,
    tool: input.tool,
    library: input.library,
    actor: input.actor,
    status: input.status,
    // 충돌 메시지에는 본문 sha까지 실린다 — 로그에는 앞부분이면 충분하다
    error: input.error ? input.error.slice(0, 500) : null,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
  });
  if (error && !isMissingMigration(error)) console.error("recordRequestLog:", error.message);
}

/** 화면의 상태 필터. URL의 `?status=`가 그대로 이 값이다. */
export type LogStatusFilter = "all" | "2xx" | "4xx" | "5xx";

export const LOG_STATUS_FILTERS: { value: LogStatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "2xx", label: "성공" },
  { value: "4xx", label: "4xx" },
  { value: "5xx", label: "5xx" },
];

/** 알 수 없는 값이 URL로 들어와도 화면이 깨지지 않게 접는다. */
export function parseLogStatusFilter(value: string | string[] | undefined): LogStatusFilter {
  const found = LOG_STATUS_FILTERS.find((item) => item.value === value);
  return found?.value ?? "all";
}

export interface LogQuery {
  status?: LogStatusFilter;
  /** 이 이메일의 요청만 — 참가자 상세가 쓴다 */
  actor?: string;
  /** 이 id 미만만 — "더 보기" 커서 */
  before?: number;
  limit?: number;
}

/** 최신 로그. 조회 실패는 빈 목록으로 떨어진다(fail-soft). */
export async function getRequestLogs(query: LogQuery = {}): Promise<RequestLogRow[]> {
  let builder = supabase
    .from("request_logs")
    .select("id, method, tool, library, actor, status, error, duration_ms, created_at")
    .order("id", { ascending: false })
    .limit(query.limit ?? 100);

  const status = query.status ?? "all";
  if (status !== "all") {
    const floor = Number(status[0]) * 100;
    builder = builder.gte("status", floor).lt("status", floor + 100);
  }
  if (query.actor) builder = builder.eq("actor", query.actor);
  if (query.before) builder = builder.lt("id", query.before);

  const { data, error } = await builder;
  if (error && !isMissingMigration(error)) console.error("getRequestLogs:", error.message);
  return (data as RequestLogRow[] | null) ?? [];
}
