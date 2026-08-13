/**
 * @file lib/diff.ts
 * @description 줄 단위 diff. 이력 화면이 "무엇으로 되돌리는지"를 보여주기 위한 것이다.
 *
 * 라이브러리를 들이지 않는다 — MCP SDK 대신 JSON-RPC를 직접 쓴 것과 같은 판단(D-009).
 * 스펙 문서의 보통 편집은 **공통 접두·접미를 떼는 것만으로 거의 끝난다.** 남은 구간만
 * LCS로 맞춘다.
 *
 * 순수 함수만 둔다. import도 없다 — `node --test`가 이 파일을 직접 실행한다 (D-008).
 */

export type DiffKind = " " | "+" | "-";

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** 바뀐 뒤 본문에서의 줄 번호(1-based). 삭제된 줄은 null */
  afterLine: number | null;
}

export interface Hunk {
  /** 이 변경을 감싸는 `##` 섹션. 첫 헤딩 앞이면 null */
  heading: string | null;
  lines: DiffLine[];
}

/**
 * ponytail: LCS DP는 O(n·m) 메모리다. 접두·접미를 뗀 뒤에도 이만큼 남으면 전면 재작성이고,
 * 그때는 diff보다 전문이 낫다. 정말 필요해지면 Myers(`diff` 패키지)로 바꾼다.
 */
const CELL_CAP = 4_000_000;

const toLines = (content: string): string[] => content.split(/\r?\n/);

/** 너무 크면 null — 호출부는 "전문 보기"로 떨어진다. */
export function diffLines(before: string, after: string): DiffLine[] | null {
  const a = toLines(before);
  const b = toLines(after);

  // 공통 접두·접미부터 뗀다. 한 줄 고치는 편집은 여기서 거의 끝난다.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;

  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail += 1;
  }

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  if (midA.length * midB.length > CELL_CAP) return null;

  const out: DiffLine[] = [];
  const push = (kind: DiffKind, text: string, afterIndex: number | null) =>
    out.push({ kind, text, afterLine: afterIndex === null ? null : afterIndex + 1 });

  for (let i = 0; i < head; i += 1) push(" ", a[i], i);

  for (const step of lcsWalk(midA, midB)) {
    if (step.kind === "-") push("-", step.text, null);
    else push(step.kind, step.text, head + step.bIndex);
  }

  for (let i = 0; i < tail; i += 1) {
    const bIndex = b.length - tail + i;
    push(" ", b[bIndex], bIndex);
  }

  return out;
}

interface Step {
  kind: DiffKind;
  text: string;
  /** `+`와 ` `일 때 midB에서의 위치 */
  bIndex: number;
}

/** 표준 LCS 표를 만들고 역추적한다. 삭제를 추가보다 먼저 내보내 `-`/`+` 순서를 고정한다. */
function* lcsWalk(a: string[], b: string[]): Generator<Step> {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint32Array(rows * cols);

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i * cols + j] =
        a[i] === b[j]
          ? table[(i + 1) * cols + (j + 1)] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + (j + 1)]);
    }
  }

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      yield { kind: " ", text: a[i], bIndex: j };
      i += 1;
      j += 1;
    } else if (table[(i + 1) * cols + j] >= table[i * cols + (j + 1)]) {
      yield { kind: "-", text: a[i], bIndex: j };
      i += 1;
    } else {
      yield { kind: "+", text: b[j], bIndex: j };
      j += 1;
    }
  }
  while (i < a.length) {
    yield { kind: "-", text: a[i], bIndex: j };
    i += 1;
  }
  while (j < b.length) {
    yield { kind: "+", text: b[j], bIndex: j };
    j += 1;
  }
}

export function countChanges(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.kind === "+") added += 1;
    else if (line.kind === "-") removed += 1;
  }
  return { added, removed };
}

/**
 * 변경 주변 `context`줄만 남기고 끊는다. 안 그러면 한 줄 고친 것 보려고 문서 전체를 읽어야 한다.
 *
 * hunk 머리에 줄 번호(`@@ -12,7 +12,9 @@`) 대신 감싸는 `##` 섹션을 쓴다 —
 * 산문에서는 "몇 번째 줄"보다 "어느 섹션"이 쓸모 있다.
 */
export function toHunks(lines: DiffLine[], after: string, context = 3): Hunk[] {
  const changed = lines.map((line) => line.kind !== " ");
  const keep = lines.map((_, index) =>
    changed.slice(Math.max(0, index - context), index + context + 1).some(Boolean),
  );

  const headings = headingIndex(after);
  const hunks: Hunk[] = [];
  let current: DiffLine[] = [];

  const flush = () => {
    if (current.length === 0) return;
    hunks.push({ heading: headingAt(headings, current), lines: current });
    current = [];
  };

  lines.forEach((line, index) => {
    if (keep[index]) current.push(line);
    else flush();
  });
  flush();

  return hunks;
}

/**
 * `after` 본문의 `##` 헤딩 시작 줄(1-based).
 *
 * `lib/spec.ts`의 `splitSections()`를 쓰지 않는다 — 그건 섹션 본문을 trim해서 줄 번호가
 * 원본과 어긋난다. 여기서 필요한 건 내용이 아니라 위치라서 직접 센다.
 */
function headingIndex(after: string): { line: number; text: string }[] {
  const index: { line: number; text: string }[] = [];
  toLines(after).forEach((text, i) => {
    const match = /^##[ \t]+(.+?)[ \t]*$/.exec(text);
    if (match) index.push({ line: i + 1, text: match[1] });
  });
  return index;
}

function headingAt(
  headings: { line: number; text: string }[],
  hunk: DiffLine[],
): string | null {
  // hunk의 첫 줄이 아니라 **첫 변경 줄** 기준이다. 앞의 context 3줄이 이전 섹션에
  // 걸쳐 있으면 엉뚱한 헤딩이 붙는다.
  const first = firstChangedAfterLine(hunk);
  if (first === undefined) return null;

  let found: string | null = null;
  for (const heading of headings) {
    if (heading.line > first) break;
    found = heading.text;
  }
  return found;
}

/** 삭제된 줄은 after에 자리가 없으므로 바로 앞 줄의 위치로 대신한다. */
function firstChangedAfterLine(hunk: DiffLine[]): number | undefined {
  let lastAfter: number | undefined;
  for (const line of hunk) {
    if (line.kind !== " ") return line.afterLine ?? lastAfter ?? 1;
    if (line.afterLine !== null) lastAfter = line.afterLine;
  }
  return undefined;
}
