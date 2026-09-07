/**
 * @file lib/summary.ts
 * @description 구조적 요약 생성기 (D-002). **LLM을 쓰지 않는다.**
 *
 * 경로 + 바뀐 `##` 섹션 + 증감 줄 수 + 편집 메모. 요약 모델은 텍스트만 보므로
 * "어느 코드가 영향받는지"는 어차피 추측이 되고, 에이전트 쪽은 경로+섹션 목록이 산문보다
 * 싸고 유용하다. 여기서 만든 문자열 하나를 알림·타임라인·`doc_changes_since`가 같이 쓴다.
 *
 * 원본이 Cushion에 있으므로 git diff가 없다(D-011). 구/신 본문을 직접 비교한다 —
 * 섹션 이름은 오히려 **정확해졌다**. diff의 hunk 위치를 되짚을 필요가 없기 때문이다.
 *
 * 순수 함수만 둔다 — DB도 fetch도 없다.
 *
 * ⚠️ **이어주는 낱말은 영어다.** 이 문자열은 `sync_events.summary`에 **저장**되고, 저장된
 *    그 한 벌을 세 곳이 나눠 쓴다 — 팀 채널 알림(한국어), 에이전트의 `doc_changes_since`
 *    델타(영어 한 벌), 그리고 웹 타임라인(보는 사람의 언어). 한 문자열이 세 언어를 만족할
 *    수 없으므로 어느 쪽으로든 골라야 했고, 중립인 영어를 골랐다.
 *
 *    비용이 크지 않은 이유: 이 줄의 대부분은 애초에 번역 대상이 아니다 — 경로, 문서가 쓴
 *    `##` 헤딩, 증감 숫자, 사람이 직접 적은 편집 메모다. 우리가 정하는 낱말은 여기 셋뿐이다.
 *
 *    제대로 고치려면 요약을 **문자열로 저장하지 말고** 구조(경로·섹션·증감)로 저장하고
 *    소비하는 쪽마다 문장을 만들어야 한다. `sync_events`에 컬럼을 더하는 마이그레이션이라
 *    사람이 실행해야 한다 — 그때까지의 절충이다.
 */
// `@/` 별칭이 아니라 확장자까지 쓴 상대 경로다. 이 파일은 `node --test`가 직접 실행하는
// 순수 모듈이고, plain Node는 tsconfig의 paths를 모른다 (D-008).
import { splitSections } from "./markdown.ts";

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
    lines.push(`deleted: ${edit.path}`);
  } else if (edit.before === null) {
    lines.push(`${edit.path} new document (+${countLines(edit.after)})`);
  } else {
    const sections = changedSections(edit.before, edit.after);
    const shown = sections.slice(0, MAX_SECTIONS).join(", ");
    const rest = sections.length > MAX_SECTIONS ? ` +${sections.length - MAX_SECTIONS} more` : "";
    const { added, removed } = lineDelta(edit.before, edit.after);
    lines.push(
      `${edit.path}${sections.length ? ` — ${shown}${rest}` : ""} (+${added} −${removed})`,
    );
  }

  const note = (edit.note ?? "").split("\n")[0].trim();
  lines.push(note ? `"${note}" — ${edit.author}` : `— ${edit.author}`);

  return lines.join("\n");
}
