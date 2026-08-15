/**
 * @file lib/usage.ts
 * @description MCP 툴 사용량의 **순수 계산**. 기간 파싱, 버킷 집계, 토큰 환산.
 *
 * 저장은 시간 단위(`usage_hourly`)다. "오늘"은 시간을 그대로 축에 쓰고, 7일·30일은
 * 시간을 날짜로 합친다 — 거친 쪽은 세밀한 쪽에서 만들 수 있지만 반대는 안 된다.
 *
 * 화면에 올리는 단위는 **토큰(추정)**이다. 저장은 문자수라 `lib/tokens.ts`가 환산한다.
 * 환산이 추정이라는 사실은 화면이 밝힌다.
 *
 * **DB를 모른다.** 접근은 `lib/usage.db.ts`가 맡는다. `lib/supabase.ts`가 env 없으면
 * 모듈 로드 시점에 죽도록(의도된 설계) 돼 있어서, 여기서 import 하면 `node --test`가
 * 이 파일을 못 연다 (D-008).
 */
import { tokensFromChars } from "./tokens.ts";

/** `usage_hourly` 한 행. day는 UTC 날짜(YYYY-MM-DD), hour는 UTC 0–23. */
export interface UsageRow {
  day: string;
  hour: number;
  tool: string;
  calls: number;
  in_chars: number;
  out_chars: number;
}

/** 화면이 고르는 기간. URL의 `?range=`가 그대로 이 값이다. */
export type UsageRange = "today" | "7d" | "30d";

export const USAGE_RANGES: { value: UsageRange; label: string; days: number }[] = [
  { value: "today", label: "오늘", days: 1 },
  { value: "7d", label: "최근 7일", days: 7 },
  { value: "30d", label: "최근 30일", days: 30 },
];

/** 알 수 없는 값이 URL로 들어와도 화면이 깨지지 않게 접는다. */
export function parseRange(value: string | string[] | undefined): UsageRange {
  const found = USAGE_RANGES.find((range) => range.value === value);
  return found?.value ?? "today";
}

export function rangeDays(range: UsageRange): number {
  return USAGE_RANGES.find((item) => item.value === range)?.days ?? 1;
}

/** UTC 기준 오늘부터 `days - 1`일 전까지의 날짜 목록(오래된 것부터). */
export function dayKeys(days: number, today = new Date()): string[] {
  const keys: string[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const date = new Date(today);
    // 월·연 경계는 setUTCDate가 알아서 넘긴다. 문자열을 직접 자르면 여기서 깨진다.
    date.setUTCDate(date.getUTCDate() - back);
    keys.push(date.toISOString().slice(0, 10));
  }
  return keys;
}

export interface UsageBucket {
  /** 축에 찍을 이름. 오늘이면 "0"–"23"(시), 아니면 "MM-DD" */
  label: string;
  /** 정렬·조회에 쓰는 원본 키 */
  key: string;
  /** 추정 토큰. 읽기와 쓰기를 합친 값이다 — 화면이 하나의 선으로 그린다 */
  tokens: number;
}

export interface UsageSummary {
  buckets: UsageBucket[];
  /** 에이전트가 **읽은** 추정 토큰 (= 툴 응답. 모델 관점에서는 입력) */
  readTokens: number;
  /** 에이전트가 **쓴** 추정 토큰 (= 툴 인자. 모델 관점에서는 출력) */
  writeTokens: number;
  totalTokens: number;
  totalCalls: number;
  /** 한 버킷 최대치. 축 눈금에 쓴다 */
  peak: number;
  /** 기록이 하나도 없으면 화면이 안내로 갈린다 */
  empty: boolean;
}

/**
 * 행을 축 버킷으로 편다. **기록이 없는 구간도 0으로 채운다** — 빈 칸을 빼면 점 간격이
 * 시간과 어긋나서 "쭉 썼다"처럼 보인다.
 *
 * `days === 1`이면 시간축(24칸), 아니면 날짜축(days칸)이다.
 */
export function bucketize(rows: UsageRow[], days: number, today = new Date()): UsageSummary {
  const hourly = days === 1;
  const keys = hourly
    ? Array.from({ length: 24 }, (_, hour) => String(hour))
    : dayKeys(days, today);

  // 토큰이 아니라 문자수로 모은 뒤 마지막에 한 번 환산한다. 버킷마다 올림하면
  // 빈 시간대까지 1토큰씩 붙어 합계가 부풀어 오른다.
  const charsIn = new Map<string, number>(keys.map((key) => [key, 0]));
  const charsOut = new Map<string, number>(keys.map((key) => [key, 0]));

  const dayWindow = new Set(dayKeys(days, today));
  let totalIn = 0;
  let totalOut = 0;
  let totalCalls = 0;

  for (const row of rows) {
    // 범위 밖 행은 버린다 — 조회에서 걸러지지만 여기서도 본다
    if (!dayWindow.has(row.day)) continue;
    const key = hourly ? String(row.hour) : row.day;
    if (!charsIn.has(key)) continue;

    charsIn.set(key, charsIn.get(key)! + row.in_chars);
    charsOut.set(key, charsOut.get(key)! + row.out_chars);
    totalIn += row.in_chars;
    totalOut += row.out_chars;
    totalCalls += row.calls;
  }

  const buckets: UsageBucket[] = keys.map((key) => ({
    key,
    label: hourly ? key : key.slice(5),
    tokens: tokensFromChars(charsIn.get(key)! + charsOut.get(key)!),
  }));

  return {
    buckets,
    // out_chars가 "에이전트가 받은 것"이다 — 이름이 관점에 따라 뒤집히므로 여기서 못 박는다
    readTokens: tokensFromChars(totalOut),
    writeTokens: tokensFromChars(totalIn),
    totalTokens: tokensFromChars(totalIn + totalOut),
    totalCalls,
    peak: Math.max(0, ...buckets.map((bucket) => bucket.tokens)),
    empty: totalCalls === 0,
  };
}
