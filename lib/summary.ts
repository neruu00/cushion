/**
 * @file lib/summary.ts
 * @description 구조적 요약 생성기 (T-302, D-002). **LLM을 쓰지 않는다.**
 *
 * 경로 + 바뀐 `##` 헤딩 + 증감 줄 수 + 커밋 메시지. 요약 모델은 diff 텍스트만 보므로
 * "어느 코드가 영향받는지"는 어차피 추측이 되고, 에이전트 쪽은 경로+헤딩 목록이 산문보다
 * 싸고 유용하다. 여기서 만든 문자열 하나를 알림과 `spec_changes_since`가 같이 쓴다.
 *
 * 순수 함수만 둔다 — DB도 fetch도 없다.
 */

export interface ChangedFile {
  path: string;
  content: string;
}

export interface DiffStat {
  added: number;
  removed: number;
  /** 각 hunk가 **새 파일**에서 시작하는 줄 번호(1-based). 헤딩을 되짚는 데 쓴다. */
  hunkStarts: number[];
}

const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)/;

/** `a/x` `b/x` 접두사를 떼고, /dev/null이면 null. */
function gitPath(raw: string): string | null {
  const value = raw.trim();
  if (!value || value === "/dev/null") return null;
  return value.replace(/^[ab]\//, "");
}

/**
 * unified diff → 파일별 증감/hunk 위치.
 *
 * hunk 안에 들어간 뒤로는 `+`/`-`를 무조건 센다. 마크다운의 `---` 구분선이 삭제되면
 * diff 줄이 `----`가 되는데, 그걸 헤더로 오인하면 카운트가 틀어진다.
 */
export function parseDiff(diff: string): Map<string, DiffStat> {
  const stats = new Map<string, DiffStat>();
  let stat: DiffStat | null = null;
  let inHunk = false;
  let fallbackPath: string | null = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      stat = { added: 0, removed: 0, hunkStarts: [] };
      inHunk = false;
      fallbackPath = null;
      continue;
    }
    if (!stat) continue;

    if (inHunk) {
      const hunk = HUNK.exec(line);
      if (hunk) {
        stat.hunkStarts.push(Number(hunk[1]));
        continue;
      }
      if (line.startsWith("+")) stat.added += 1;
      else if (line.startsWith("-")) stat.removed += 1;
      continue;
    }

    if (line.startsWith("--- ")) {
      fallbackPath = gitPath(line.slice(4));
      continue;
    }
    if (line.startsWith("+++ ")) {
      // 삭제된 파일은 +++ 가 /dev/null이라 --- 쪽 경로로 떨어진다.
      const path = gitPath(line.slice(4)) ?? fallbackPath;
      if (path) stats.set(path, stat);
      continue;
    }
    const hunk = HUNK.exec(line);
    if (hunk) {
      inHunk = true;
      stat.hunkStarts.push(Number(hunk[1]));
    }
  }

  return stats;
}

/** 첫 `# ` 헤딩. 문서 제목으로 쓴다. */
export function documentTitle(content: string): string | null {
  const match = /^#[ \t]+(.+?)[ \t]*$/m.exec(content);
  return match ? match[1] : null;
}

/**
 * 각 hunk가 **어느 `##` 섹션 안에서** 일어났는지.
 * diff만으로는 알 수 없어서 바뀐 뒤의 본문을 같이 본다 — 그래서 sync 페이로드가 내용을 싣는다.
 */
export function changedHeadings(content: string, hunkStarts: number[]): string[] {
  const headings: { line: number; text: string }[] = [];
  content.split("\n").forEach((line, index) => {
    const match = /^##[ \t]+(.+?)[ \t]*$/.exec(line);
    if (match) headings.push({ line: index + 1, text: match[1] });
  });

  const found: string[] = [];
  for (const start of hunkStarts) {
    let current: string | null = null;
    for (const heading of headings) {
      if (heading.line > start) break;
      current = heading.text;
    }
    if (current && !found.includes(current)) found.push(current);
  }
  return found;
}

export interface SummaryInput {
  changed: ChangedFile[];
  deleted: string[];
  diff: string;
  commit: { sha: string; author: string; message: string };
  truncated: boolean;
  githubFullName: string | null;
}

/** 알림 하나가 토큰을 태우면 본말전도다. 파일 목록은 여기서 끊는다. */
const MAX_FILE_LINES = 10;

export function buildSummary(input: SummaryInput): string {
  const stats = parseDiff(input.diff);
  const lines: string[] = [];

  for (const file of input.changed.slice(0, MAX_FILE_LINES)) {
    const stat = stats.get(file.path);
    const headings = stat ? changedHeadings(file.content, stat.hunkStarts) : [];
    const counts = stat ? ` (+${stat.added} −${stat.removed})` : "";
    lines.push(`${file.path}${headings.length ? ` — ${headings.join(", ")}` : ""}${counts}`);
  }
  if (input.changed.length > MAX_FILE_LINES) {
    lines.push(`외 ${input.changed.length - MAX_FILE_LINES}건`);
  }

  if (input.deleted.length) lines.push(`삭제: ${input.deleted.join(", ")}`);

  const message = input.commit.message.split("\n")[0].trim();
  if (message) lines.push(`"${message}" — ${input.commit.author || "unknown"}`);

  if (input.githubFullName && input.commit.sha) {
    lines.push(`https://github.com/${input.githubFullName}/commit/${input.commit.sha}`);
  }
  if (input.truncated) lines.push("(diff 일부 생략)");

  return lines.join("\n") || "변경 없음";
}

/** 스펙 diff는 산문이라 짧으면 원문이 그 자체로 읽힌다. (SPEC §8) */
const SHORT_DIFF_LINES = 40;

/**
 * 알림 본문 = 저장된 요약 + (짧으면) 원문 diff.
 * diff를 `summary`에 넣지 않는 이유: 그 컬럼을 `spec_changes_since`가 그대로 되판다.
 * 에이전트에게 diff 40줄을 매번 실어 보내는 건 이 도구가 없애려는 낭비다.
 */
export function notificationText(summary: string, diff: string): string {
  const trimmed = diff.trimEnd();
  if (!trimmed.trim()) return summary;
  if (trimmed.split("\n").length > SHORT_DIFF_LINES) return summary;
  return `${summary}\n\`\`\`diff\n${trimmed}\n\`\`\``;
}
