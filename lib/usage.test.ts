/**
 * @file lib/usage.test.ts
 * @description 버킷 계산. 여기가 틀리면 선 그래프가 조용히 거짓말한다 — 선은 그려지는데
 * 시간이 어긋나거나 합계가 안 맞는 식이라 눈으로는 못 잡는다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { bucketize, dayKeys, parseRange, type UsageRow } from "./usage.ts";

const TODAY = new Date("2026-08-16T05:00:00Z");

const row = (over: Partial<UsageRow>): UsageRow => ({
  day: "2026-08-16",
  hour: 0,
  tool: "doc_get",
  calls: 1,
  in_chars: 0,
  out_chars: 0,
  ...over,
});

test("dayKeys는 오래된 것부터 오늘까지 UTC 날짜를 준다", () => {
  assert.deepEqual(dayKeys(3, TODAY), ["2026-08-14", "2026-08-15", "2026-08-16"]);
});

test("월 경계를 넘어가도 날짜가 이어진다", () => {
  // setUTCDate에 음수가 들어가는 경로다. 직접 문자열을 자르면 여기서 깨진다.
  assert.deepEqual(dayKeys(3, new Date("2026-09-01T00:00:00Z")), [
    "2026-08-30",
    "2026-08-31",
    "2026-09-01",
  ]);
});

test("오늘은 24칸 시간축이다", () => {
  const summary = bucketize([], 1, TODAY);

  assert.equal(summary.buckets.length, 24);
  assert.equal(summary.buckets[0].label, "0");
  assert.equal(summary.buckets[23].label, "23");
});

test("7일·30일은 날짜축이고 라벨이 MM-DD다", () => {
  const week = bucketize([], 7, TODAY);

  assert.equal(week.buckets.length, 7);
  assert.equal(week.buckets[6].label, "08-16");
  assert.equal(bucketize([], 30, TODAY).buckets.length, 30);
});

test("시간축에서 행이 제 시간 칸에 들어간다", () => {
  const summary = bucketize([row({ hour: 9, out_chars: 2400 })], 1, TODAY);

  assert.equal(summary.buckets[9].tokens, 1000);
  // 나머지 23칸은 0이어야 한다 — 빈 칸을 빼면 선이 시간과 어긋난다
  assert.equal(summary.buckets.filter((b) => b.tokens > 0).length, 1);
});

test("날짜축에서는 시간이 하루로 합쳐진다", () => {
  const rows = [
    row({ day: "2026-08-16", hour: 1, out_chars: 1200 }),
    row({ day: "2026-08-16", hour: 20, out_chars: 1200 }),
  ];
  const summary = bucketize(rows, 7, TODAY);

  assert.equal(summary.buckets[6].tokens, 1000);
});

test("읽기와 쓰기가 한 선으로 합쳐진다", () => {
  const summary = bucketize([row({ hour: 3, out_chars: 1200, in_chars: 1200 })], 1, TODAY);

  assert.equal(summary.buckets[3].tokens, 1000);
  assert.equal(summary.readTokens, 500);
  assert.equal(summary.writeTokens, 500);
  assert.equal(summary.totalTokens, 1000);
});

test("out_chars가 읽기다 — 관점이 뒤집혀도 값은 안 바뀐다", () => {
  // 모델 관점에서 응답(out_chars)은 입력 토큰이 된다. 이름을 헷갈리면 그래프의
  // 읽기/쓰기가 통째로 뒤바뀌는데, 합계가 같아서 눈으로는 못 잡는다.
  const summary = bucketize([row({ out_chars: 2400, in_chars: 240 })], 1, TODAY);

  assert.equal(summary.readTokens, 1000);
  assert.equal(summary.writeTokens, 100);
});

test("버킷마다 올림하지 않는다 — 합계가 부풀면 안 된다", () => {
  // 칸마다 Math.ceil을 돌리면 1자짜리 행 10개가 10토큰이 된다.
  const rows = Array.from({ length: 10 }, (_, hour) => row({ hour, out_chars: 1 }));
  const summary = bucketize(rows, 1, TODAY);

  assert.equal(summary.totalTokens, 5); // 10자 ÷ 2.4 = 4.16 → 5
  assert.ok(summary.buckets.reduce((sum, b) => sum + b.tokens, 0) >= summary.totalTokens);
});

test("peak은 가장 높은 칸이다", () => {
  const rows = [row({ hour: 2, out_chars: 240 }), row({ hour: 5, out_chars: 2400 })];
  const summary = bucketize(rows, 1, TODAY);

  assert.equal(summary.peak, 1000);
});

test("범위 밖 날짜는 버린다", () => {
  const summary = bucketize([row({ day: "2026-01-01", out_chars: 9999 })], 3, TODAY);

  assert.equal(summary.totalTokens, 0);
  assert.equal(summary.empty, true);
});

test("기록이 없으면 empty — 화면이 안내로 갈린다", () => {
  const summary = bucketize([], 7, TODAY);

  assert.equal(summary.empty, true);
  assert.equal(summary.peak, 0);
  assert.equal(summary.buckets.length, 7);
});

test("모르는 range는 today로 접는다", () => {
  assert.equal(parseRange("30d"), "30d");
  assert.equal(parseRange(undefined), "today");
  assert.equal(parseRange("../etc/passwd"), "today");
  assert.equal(parseRange(["7d", "30d"]), "today");
});
