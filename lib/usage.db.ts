/**
 * @file lib/usage.db.ts
 * @description `usage_hourly` 쓰기 (스키마는 supabase/migrations/0001_schema.sql).
 *
 * 읽는 쪽은 /admin이 직접 질의한다 — 소비자가 하나뿐이라 여기 한 겹을 더 두지 않는다.
 * 계산은 `lib/usage.ts`에 있고 여기는 DB만 만진다. 나눈 이유는 테스트다 —
 * `lib/supabase.ts`가 env 없으면 모듈 로드 시점에 죽어서, 순수 함수가 같은 파일에
 * 있으면 `node --test`가 파일을 못 연다 (D-008).
 */
import { supabase } from "./supabase";

/** PostgREST: 스키마 캐시에 테이블/함수가 없다 = 스키마를 아직 안 돌렸다 */
const MISSING_TABLE = "PGRST205";
const MISSING_FUNCTION = "PGRST202";

interface PostgrestErrorish {
  code?: string;
  message?: string;
  hint?: string | null;
}

/**
 * 에러를 **문자열로** 남긴다. 객체 그대로 넘기면 Next dev 오버레이가 `{}`로 접어서
 * 코드도 메시지도 안 보인다 — 실제로 그 상태로 한 번 헤맸다.
 */
function describe(error: PostgrestErrorish): string {
  return [error.code, error.message, error.hint].filter(Boolean).join(" · ");
}

/**
 * 마이그레이션 전이라는 사실은 한 번만 알린다. 렌더마다·툴 호출마다 스택을 뱉으면
 * 진짜 오류가 그 안에 묻힌다. 프로세스 수명 동안 한 번이면 충분하다.
 */
let migrationNoticeShown = false;

/** 아직 마이그레이션 전이면 true — 호출부는 조용히 빈 값으로 떨어진다. */
function isMissingMigration(error: PostgrestErrorish): boolean {
  if (error.code !== MISSING_TABLE && error.code !== MISSING_FUNCTION) return false;
  if (!migrationNoticeShown) {
    migrationNoticeShown = true;
    console.warn(
      "usage: supabase/migrations/0001_schema.sql 을 다시 돌려야 한다(usage_hourly 없음). " +
        "요청 수는 비어 있고 나머지 기능은 정상이다.",
    );
  }
  return true;
}

/**
 * 툴 호출 하나를 더한다. **실패해도 삼킨다** — 사용량 기록이 안 됐다고 에이전트의
 * 툴 응답을 깨뜨릴 이유가 없다.
 *
 * 라이브러리에 귀속되지 않는 호출(library 인자 없는 doc_outline, library_create)에는
 * 부르지 않는다. 그만큼 과소집계되고, 그 사실을 /admin의 요청 수 설명이 밝힌다.
 *
 * 비용을 알고 쓴다: 호출당 쓰기 하나가 붙는다. `last_used_at`이 5분 스로틀로 지워 둔
 * 그 비용이 되살아나는 것이다. 무거워지면 여기에 배치·스로틀을 건다.
 */
export async function recordUsage(input: {
  libraryId: string;
  tool: string;
  inChars: number;
  outChars: number;
}): Promise<void> {
  const { error } = await supabase.rpc("record_usage", {
    p_library: input.libraryId,
    p_tool: input.tool,
    p_in: input.inChars,
    p_out: input.outChars,
  });
  if (error && !isMissingMigration(error)) console.error("recordUsage:", describe(error));
}
