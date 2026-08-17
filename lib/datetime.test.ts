/**
 * @file lib/datetime.test.ts
 * @description 시각 표기. 여기가 틀리면 화면이 조용히 8시간 어긋난 시각을 보여준다 —
 * 그럴듯한 숫자라 눈으로는 못 잡는다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDate, formatDateTime } from "./datetime.ts";

// 기본값(Asia/Seoul) 기준이다. CUSHION_TZ가 설정된 환경에서는 이 테스트가 의미를 잃으므로
// 그때는 건너뛴다 — 틀린 실패로 다음 사람을 헤매게 하지 않는다.
const DEFAULT_TZ = !process.env.CUSHION_TZ;

test("UTC를 KST로 옮긴다 — +9시간", { skip: !DEFAULT_TZ }, () => {
  // 이 프로젝트의 실제 sync_events 값 모양
  assert.equal(formatDateTime("2026-08-15T07:21:12.748317+00:00"), "2026-08-15 16:21");
  assert.equal(formatDate("2026-08-15T07:21:12.748317+00:00"), "2026-08-15");
});

test("날짜 경계를 넘긴다 — UTC 밤이면 KST는 다음 날", { skip: !DEFAULT_TZ }, () => {
  // slice(0,10)을 쓰던 목록이 정확히 이 지점에서 하루 전 날짜를 보여주고 있었다
  assert.equal(formatDate("2026-08-15T15:30:00+00:00"), "2026-08-16");
  assert.equal(formatDateTime("2026-08-15T15:30:00+00:00"), "2026-08-16 00:30");
});

test("자정을 24시로 쓰지 않는다", { skip: !DEFAULT_TZ }, () => {
  // hour12:false에서 자정을 "24"로 내는 로케일이 있다. 날짜가 이미 넘어갔으므로 00이 맞다.
  assert.equal(formatDateTime("2026-08-15T15:00:00+00:00"), "2026-08-16 00:00");
});

test("자릿수를 채운다 — 한 자리 월·일·시", { skip: !DEFAULT_TZ }, () => {
  assert.equal(formatDateTime("2026-01-02T00:05:00+00:00"), "2026-01-02 09:05");
});

test("표기 모양이 고정이다", () => {
  // 화면마다 표기가 갈리면 같은 시각인지 눈으로 대조할 수 없다.
  assert.match(formatDate("2026-08-15T07:21:12+00:00"), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(formatDateTime("2026-08-15T07:21:12+00:00"), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
});

test("timestamptz의 여러 표기를 다 받는다", () => {
  // Supabase는 +00:00으로 주지만 Z나 밀리초 없는 형태도 들어올 수 있다
  const shapes = [
    "2026-08-15T07:21:12+00:00",
    "2026-08-15T07:21:12Z",
    "2026-08-15T07:21:12.748317+00:00",
  ];
  const results = shapes.map(formatDateTime);
  assert.equal(new Set(results).size, 1, `표기별로 결과가 갈린다: ${results.join(" / ")}`);
});

test("프로세스 TZ가 바뀌어도 흔들리지 않는다", () => {
  // 서버와 브라우저의 기본 타임존이 다르면 SSR과 하이드레이션이 갈린다.
  // timeZone을 명시했으므로 이 조작에 영향받지 않아야 한다.
  const before = formatDateTime("2026-08-15T07:21:12+00:00");
  const original = process.env.TZ;
  process.env.TZ = "America/New_York";
  const after = formatDateTime("2026-08-15T07:21:12+00:00");
  if (original === undefined) delete process.env.TZ;
  else process.env.TZ = original;

  assert.equal(before, after);
});
