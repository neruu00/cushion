/**
 * @file lib/usage.ts
 * @description `usage_hourly`를 읽는 화면이 공유하는 순수 계산.
 *
 * 저장은 시간 단위(`usage_hourly`)이고 키가 **UTC 날짜·시각**이다 (D-018).
 * 그래서 여기서 만드는 날짜 목록도 UTC다 — `lib/datetime.ts`로 현지화하면
 * "오늘"의 경계가 데이터와 어긋난다.
 *
 * **DB를 모른다.** 접근은 `lib/usage.db.ts`가 맡는다. `lib/supabase.ts`가 env 없으면
 * 모듈 로드 시점에 죽도록(의도된 설계) 돼 있어서, 여기서 import 하면 `node --test`가
 * 이 파일을 못 연다 (D-008).
 */

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
