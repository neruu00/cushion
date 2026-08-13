/**
 * @file lib/spec.ts
 * @description 마크다운 섹션 유틸. 섹션 분할은 `^## ` 기준 문자열 split이다 —
 *              마크다운 파서 의존성을 들이지 않는다 (SPEC §7).
 *
 * 순수 함수만 둔다. MCP 툴의 절감 로직(목차 먼저 · 섹션만 · substring 검색)이 전부 여기 얹힌다.
 */

export interface Section {
  /** `## ` 뒤의 제목. 첫 헤딩 앞의 머리말은 null */
  heading: string | null;
  /** 헤딩 줄을 포함한 본문 */
  text: string;
}

const H2 = /^##[ \t]+(.+?)[ \t]*$/;

/**
 * CRLF도 받는다. `\r`가 줄 끝에 남으면 `.`가 그걸 매치하지 않아 H2가 통째로 어긋난다 —
 * 목차가 비어 나오는데 원인이 안 보이는 종류의 버그다. 수신부(sync.schema)에서도 접지만
 * 이 함수만 따로 불릴 수 있으므로 여기서도 방어한다.
 */
const lines = (content: string): string[] => content.split(/\r?\n/);

export function splitSections(content: string): Section[] {
  const sections: Section[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (heading !== null || text) sections.push({ heading, text });
  };

  for (const line of lines(content)) {
    const match = H2.exec(line);
    if (match) {
      flush();
      heading = match[1];
      buffer = [line];
      continue;
    }
    buffer.push(line);
  }
  flush();

  return sections;
}

export function headings(content: string): string[] {
  return splitSections(content)
    .map((section) => section.heading)
    .filter((heading): heading is string => heading !== null);
}

/** 에이전트가 `## 인증`으로 주든 `인증`으로 주든 받는다. 대소문자·공백 무시. */
function normalize(value: string): string {
  return value.replace(/^#+/, "").trim().toLowerCase();
}

export function findSection(content: string, heading: string): string | null {
  const wanted = normalize(heading);
  const hit = splitSections(content).find(
    (section) => section.heading !== null && normalize(section.heading) === wanted,
  );
  return hit ? hit.text : null;
}

/**
 * `heading` 섹션만 `replacement`로 바꾼 전문을 돌려준다. 섹션이 없으면 null.
 *
 * `spec_put(heading)`의 본체다 — 에이전트가 섹션 하나 고치는 데 문서 전체를 보내지 않게 한다.
 * `replacement`는 `spec_get(heading)`이 돌려주는 모양 그대로, 즉 `## 헤딩` 줄을 포함한
 * 섹션 전체다.
 *
 * `splitSections()`로 재조립하지 않는다 — 그건 섹션을 trim해서 손대지 않은 부분의
 * 바이트가 바뀌고, sha가 흔들리고, 이력 diff가 시끄러워진다. 원본 줄을 그대로 잇는다.
 */
export function replaceSection(
  content: string,
  heading: string,
  replacement: string,
): string | null {
  const wanted = normalize(heading);
  const lines = content.split(/\r?\n/);

  let start = -1;
  let end = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const match = H2.exec(lines[i]);
    if (!match) continue;
    if (start === -1) {
      if (normalize(match[1]) === wanted) start = i;
    } else {
      end = i;
      break;
    }
  }
  if (start === -1) return null;

  // 교체 텍스트 꼬리의 공백·빈 줄은 접는다. 다음 섹션과의 이음매(빈 줄 하나)는
  // 우리가 넣는다 — 에이전트마다 꼬리 줄바꿈이 제각각이라 여기서 고정해야 sha가 안정된다.
  const body = replacement.replace(/\s+$/, "").split(/\r?\n/);

  return [...lines.slice(0, start), ...body, "", ...lines.slice(end)].join("\n");
}

/**
 * substring 스코어링. 임베딩·벡터DB를 쓰지 않는다 — 스펙 수십 개 규모에서 정당화되지 않는다 (D-004).
 * 헤딩에 맞으면 가중치를 준다. 문서를 찾는 사람은 대개 섹션 이름을 떠올리고 있다.
 */
export function scoreSection(section: Section, query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;

  const inHeading = countOccurrences((section.heading ?? "").toLowerCase(), needle);
  const inBody = countOccurrences(section.text.toLowerCase(), needle);
  return inHeading * 5 + inBody;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
}

/** 첫 매칭 주변만 잘라 낸다. 검색 결과로 본문 전체를 실어 보내면 절감이 사라진다. */
export function snippet(text: string, query: string, radius = 60): string {
  const at = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (at === -1) return text.slice(0, radius * 2).trim();

  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + query.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${
    end < text.length ? "…" : ""
  }`;
}
