/**
 * @file lib/usage.test.ts
 * @description 날짜 키 검증. UTC 경계가 어긋나면 /admin의 요청 수 축이 하루씩 밀린다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { dayKeys } from "./usage.ts";

const AT = new Date("2026-03-02T05:00:00Z");

test("dayKeys는 오래된 것부터 오늘까지 UTC 날짜를 준다", () => {
  assert.deepEqual(dayKeys(3, AT), ["2026-02-28", "2026-03-01", "2026-03-02"]);
});

test("월 경계를 넘어가도 날짜가 이어진다", () => {
  assert.deepEqual(dayKeys(4, new Date("2026-01-02T00:00:00Z")), [
    "2025-12-30",
    "2025-12-31",
    "2026-01-01",
    "2026-01-02",
  ]);
});

test("하루만 물으면 오늘 하나다", () => {
  assert.deepEqual(dayKeys(1, AT), ["2026-03-02"]);
});
