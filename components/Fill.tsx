/**
 * @file components/Fill.tsx
 * @description `{name}` 자리에 **문자열이 아니라 요소**를 끼운다. 문장 중간에 `<code>`나
 *              `<strong>`이 들어가는데 어순이 언어마다 다를 때 쓴다.
 *
 * `fill()`(lib/utils.ts)은 문자열만 만든다. 그걸로 `<code>`를 끼우려면 문장을 조각내서
 * 사전에 넣어야 하는데, 그러면 번역하는 쪽이 조각의 순서를 맞춰야 해서 어순이 다른
 * 언어에서 바로 무너진다. 자리표시자는 문장 안에 그대로 두고 여기서 요소로 바꾼다.
 *
 * 서버·클라이언트 양쪽에서 쓴다 — 순수 함수 하나뿐이라 `'use client'`가 필요 없다.
 */

interface FillProps {
  /** `{name}` 자리표시자가 들어 있는 사전 문자열 */
  template: string;
  /** 자리표시자 이름 → 끼울 요소 */
  parts: Record<string, React.ReactNode>;
}

export function Fill({ template, parts }: FillProps) {
  // 캡처 그룹이 있어서 split 결과에 구분자도 남는다 — 홀수 인덱스가 자리표시자다
  const pieces = template.split(/\{(\w+)\}/g);

  return (
    <>
      {pieces.map((piece, index) =>
        index % 2 === 1 ? (
          // 모르는 이름이면 자리표시자를 그대로 남긴다. 조용히 사라지면 못 찾는다
          <span key={index}>{piece in parts ? parts[piece] : `{${piece}}`}</span>
        ) : (
          piece
        ),
      )}
    </>
  );
}
