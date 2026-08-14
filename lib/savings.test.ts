/**
 * @file lib/savings.test.ts
 * @description 예측 절약 검증. 숫자 놀음이지만 방향이 틀리면 화면이 거짓말을 한다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { estimateSavings } from "./savings.ts";

const doc = (sections: number, lines: number) => ({
  path: "SPEC.md",
  title: "스펙",
  content:
    "# 스펙\n\n" +
    Array.from({ length: sections }, (_, i) =>
      [`## 섹션 ${i}`, "", ...Array.from({ length: lines }, (_, j) => `내용 줄 ${i}-${j}입니다.`)].join("\n"),
    ).join("\n\n"),
});

test("문서가 없으면 null — 보여줄 근거가 없다", () => {
  assert.equal(estimateSavings([]), null);
});

test("큰 문서일수록 절약이 크고 비율이 1을 넘는다", () => {
  const s = estimateSavings([doc(10, 20)]);

  assert.ok(s);
  assert.ok(s.savedTokens > 0);
  assert.ok(s.ratio > 1);
  assert.ok(s.outlineTokens < s.controlTokens);
  // 실험군 = 목차 + 섹션 하나 < 전량
  assert.ok(s.outlineTokens + s.perTaskTokens < s.controlTokens);
});

test("아주 작은 문서는 절약이 음수일 수 있다 — 정직하게 돌려준다", () => {
  const s = estimateSavings([{ path: "a.md", title: "a", content: "# a\n한 줄." }]);

  assert.ok(s);
  assert.ok(s.savedTokens <= 0);
});

test("CRLF 문서도 같은 결과", () => {
  const lf = estimateSavings([doc(5, 10)]);
  const crlf = estimateSavings([
    { ...doc(5, 10), content: doc(5, 10).content.replace(/\n/g, "\r\n") },
  ]);

  assert.ok(lf && crlf);
  // 입구에서 LF로 접으므로 결과가 완전히 같아야 한다
  assert.deepEqual(crlf, lf);
});

test("여러 문서면 목차는 전부, 섹션은 평균 하나", () => {
  const one = estimateSavings([doc(5, 10)]);
  const two = estimateSavings([doc(5, 10), doc(5, 10)]);

  assert.ok(one && two);
  assert.ok(two.controlTokens > one.controlTokens);
  assert.ok(two.outlineTokens > one.outlineTokens);
  // 평균 섹션 크기는 같은 문서 두 벌이면 그대로다
  assert.equal(two.perTaskTokens, one.perTaskTokens);
});
