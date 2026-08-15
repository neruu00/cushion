/**
 * @file lib/tokens.ts
 * @description 문자수 → 토큰 **추정**.
 *
 * 진짜 토큰 수는 모델 쪽에서만 안다. Cushion은 오간 문자열의 길이까지만 알고, 그걸
 * 토큰으로 바꾸는 순간부터는 추측이다. 그래서 화면은 어디서든 '추정'을 명시한다.
 *
 * 그래도 계수를 하나로 두지 않는 이유: 한 글자가 차지하는 토큰이 문자 종류마다 크게
 * 다르다. 한글·한자는 글자당 토큰이 많이 들고(대략 1.7자에 1토큰), 라틴 문자는 훨씬
 * 적게 든다(대략 3.8자에 1토큰). 단일 계수(÷2)를 쓰면 영문·코드가 많은 문서에서
 * 토큰을 두 배 가까이 부풀린다 — 절대값을 축에 올리는 순간 그 오차가 그대로 보인다.
 *
 * 순수 함수뿐이라 `node --test`가 직접 실행한다 (D-008).
 */

/** 한글 음절·자모, CJK 통합 한자, 가나. 글자당 토큰을 많이 먹는 무리 */
const DENSE = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-䶿一-鿿가-힯]/;

/** 조밀 문자: 대략 1.7자에 1토큰 */
const DENSE_CHARS_PER_TOKEN = 1.7;
/** 그 외(라틴·숫자·공백·기호): 대략 3.8자에 1토큰 */
const LOOSE_CHARS_PER_TOKEN = 3.8;

/**
 * 문자열 하나의 추정 토큰 수.
 *
 * 문자를 두 무리로만 가른다. 더 잘게 나눠도 정확해지지 않는다 — 진짜 토크나이저는
 * 글자가 아니라 바이트열 병합 규칙으로 자르기 때문에, 글자 단위 근사의 한계가
 * 계수의 정밀도보다 훨씬 크다.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let dense = 0;
  for (const char of text) {
    if (DENSE.test(char)) dense += 1;
  }
  const loose = [...text].length - dense;

  return Math.ceil(dense / DENSE_CHARS_PER_TOKEN + loose / LOOSE_CHARS_PER_TOKEN);
}

/**
 * 이미 문자수만 남은 값(집계 행)을 토큰으로 바꾼다.
 *
 * 원문이 없으니 문자 구성을 알 수 없다. 문서가 한국어 산문 위주라는 전제로 조밀 쪽에
 * 가깝게 잡되, 코드 블록·경로·영문이 섞이는 걸 감안해 두 계수 사이를 쓴다.
 * **원문이 있으면 `estimateTokens`를 쓴다** — 이건 어쩔 수 없을 때의 대체다.
 */
const MIXED_CHARS_PER_TOKEN = 2.4;

export function tokensFromChars(chars: number): number {
  return Math.ceil(chars / MIXED_CHARS_PER_TOKEN);
}
