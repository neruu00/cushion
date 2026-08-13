/**
 * @file lib/summary.ts
 * @description 구조적 요약 생성기 (D-002). **LLM을 쓰지 않는다.**
 *
 * 경로 + 바뀐 `##` 섹션 + 증감 줄 수 + 편집 메모. 요약 모델은 텍스트만 보므로
 * "어느 코드가 영향받는지"는 어차피 추측이 되고, 에이전트 쪽은 경로+섹션 목록이 산문보다
 * 싸고 유용하다. 여기서 만든 문자열 하나를 알림·타임라인·`spec_changes_since`가 같이 쓴다.
 *
 * 원본이 Cushion에 있으므로 git diff가 없다(D-011). 구/신 본문을 직접 비교한다 —
 * 섹션 이름은 오히려 **정확해졌다**. diff의 hunk 위치를 되짚을 필요가 없기 때문이다.
 *
 * 순수 함수만 둔다 — DB도 fetch도 없다.
 */
// `@/` 별칭이 아니라 확장자까지 쓴 상대 경로다. 이 파일은 `node --test`가 직접 실행하는
// 순수 모듈이고, plain Node는 tsconfig의 paths를 모른다 (D-008).
import { splitSections } from "./spec.ts";

/**
 * 첫 `# ` 헤딩. 문서 제목으로 쓴다.
 * 줄 단위로 보는 이유: CRLF면 `\r`가 남는데 정규식 `.`가 그걸 매치하지 않아 통째로 어긋난다.
 */
export function documentTitle(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const match = /^#[ \t]+(.+?)[ \t]*$/.exec(line);
    if (match) return match[1];
  }
  return null;
}

/**
 * 양쪽에 있으나 내용이 다른 섹션 + 한쪽에만 있는 섹션.
 * 첫 `##` 앞의 머리말은 이름이 없어 목록에 넣지 않는다 — 대신 증감 수치에는 반영된다.
 */
export function changedSections(before: string, after: string): string[] {
  const index = (content: string) =>
    new Map(
      splitSections(content)
        .filter((section) => section.heading !== null)
        .map((section) => [section.heading as string, section.text]),
    );

  const old = index(before);
  const next = index(after);
  const changed: string[] = [];

  for (const [heading, text] of next) if (old.get(heading) !== text) changed.push(heading);
  for (const heading of old.keys()) if (!next.has(heading)) changed.push(heading);

  return changed;
}

/**
 * ponytail: 줄 다중집합 차이로 센다. 옮겨 적기만 한 줄은 변경으로 치지 않으므로
 * unified diff보다 오히려 덜 시끄럽지만, 같은 줄이 여러 번 나오는 문서에서는 근사값이다.
 * 정확한 수치가 필요해지면 그때 diff 라이브러리를 들인다.
 */
function lineDelta(before: string, after: string): { added: number; removed: number } {
  const tally = (content: string) => {
    const counts = new Map<string, number>();
    for (const line of content.split(/\r?\n/)) counts.set(line, (counts.get(line) ?? 0) + 1);
    return counts;
  };

  const old = tally(before);
  const next = tally(after);
  let added = 0;
  let removed = 0;

  for (const [line, n] of next) added += Math.max(0, n - (old.get(line) ?? 0));
  for (const [line, n] of old) removed += Math.max(0, n - (next.get(line) ?? 0));

  return { added, removed };
}

function countLines(content: string): number {
  const trimmed = content.replace(/(\r?\n)+$/, "");
  return trimmed ? trimmed.split(/\r?\n/).length : 0;
}

export interface DocumentEdit {
  path: string;
  /** 새 문서면 null */
  before: string | null;
  /** 삭제면 null */
  after: string | null;
  author: string;
  note?: string | null;
}

/** 섹션 목록은 여기서 끊는다. 알림 하나가 토큰을 태우면 본말전도다. */
const MAX_SECTIONS = 5;

export function summarizeEdit(edit: DocumentEdit): string {
  const lines: string[] = [];

  if (edit.after === null) {
    lines.push(`삭제: ${edit.path}`);
  } else if (edit.before === null) {
    lines.push(`${edit.path} 새 문서 (+${countLines(edit.after)})`);
  } else {
    const sections = changedSections(edit.before, edit.after);
    const shown = sections.slice(0, MAX_SECTIONS).join(", ");
    const rest = sections.length > MAX_SECTIONS ? ` 외 ${sections.length - MAX_SECTIONS}개` : "";
    const { added, removed } = lineDelta(edit.before, edit.after);
    lines.push(
      `${edit.path}${sections.length ? ` — ${shown}${rest}` : ""} (+${added} −${removed})`,
    );
  }

  const note = (edit.note ?? "").split("\n")[0].trim();
  lines.push(note ? `"${note}" — ${edit.author}` : `— ${edit.author}`);

  return lines.join("\n");
}
