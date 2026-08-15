/**
 * @file lib/tokens.test.ts
 * @description 토큰 추정. 축에 절대값을 올리므로, 여기가 치우치면 화면이 통째로 거짓말한다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { estimateTokens, tokensFromChars } from "./tokens.ts";

test("빈 문자열은 0", () => {
  assert.equal(estimateTokens(""), 0);
});

test("같은 글자수라도 한글이 라틴보다 토큰을 많이 먹는다", () => {
  // 단일 계수(÷2)를 쓰면 이 둘이 같아진다. 그게 이 모듈이 존재하는 이유다.
  const korean = estimateTokens("가".repeat(100));
  const latin = estimateTokens("a".repeat(100));

  assert.ok(korean > latin, `한글 ${korean} > 라틴 ${latin}`);
  assert.ok(korean / latin > 1.5, `비율이 너무 작다: ${korean / latin}`);
});

test("한글 100자는 대략 59토큰 (1.7자/토큰)", () => {
  assert.equal(estimateTokens("가".repeat(100)), Math.ceil(100 / 1.7));
});

test("라틴 100자는 대략 27토큰 (3.8자/토큰)", () => {
  assert.equal(estimateTokens("a".repeat(100)), Math.ceil(100 / 3.8));
});

test("섞이면 두 계수가 각각 적용된다", () => {
  const mixed = estimateTokens("가".repeat(50) + "a".repeat(50));
  const expected = Math.ceil(50 / 1.7 + 50 / 3.8);

  assert.equal(mixed, expected);
});

test("한자·가나도 조밀 무리로 센다", () => {
  // 코드 포인트 범위를 잘못 잡으면 이것들이 라틴으로 새서 토큰이 과소평가된다.
  assert.equal(estimateTokens("漢".repeat(10)), estimateTokens("가".repeat(10)));
  assert.equal(estimateTokens("あ".repeat(10)), estimateTokens("가".repeat(10)));
});

test("길이에 단조 증가한다", () => {
  let previous = 0;
  for (const n of [1, 10, 100, 1000]) {
    const current = estimateTokens("문서 내용 sample text ".repeat(n));
    assert.ok(current > previous, `${n}회 반복에서 줄었다`);
    previous = current;
  }
});

test("문자수만 남은 값도 환산된다", () => {
  assert.equal(tokensFromChars(0), 0);
  assert.equal(tokensFromChars(2400), 1000);
  // 원문 기반 추정과 자릿수가 어긋나지 않아야 한다 — 한 화면에 같이 나오기 때문이다.
  const text = "문서 내용이 섞여 있는 sample text 입니다. ".repeat(50);
  const direct = estimateTokens(text);
  const fromChars = tokensFromChars(text.length);
  assert.ok(Math.max(direct, fromChars) / Math.min(direct, fromChars) < 1.5);
});
