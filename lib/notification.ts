/**
 * @file lib/notification.ts
 * @description 채널에 보낼 알림 메시지 한 통을 만든다. 여러 변경을 **하나로 묶는다.**
 *
 * 묶기 전에는 편집 한 번이 알림 한 건이었다. 에이전트는 섹션 단위로 연달아 쓰기 때문에
 * 실측(sync_events 49건)으로 같은 사람의 연속 편집 간격이 중앙값 38초, 47번 중 34번이
 * 60초 이내였다. 채널이 같은 문서 알림으로 도배되면 사람은 그냥 안 읽는다 —
 * 알림이 있으나 없으나 같아진다.
 *
 * **요약을 여기서 다시 만들지 않는다.** `sync_events.summary`(구조적 요약, D-002)를 그대로
 * 쓴다. 두 번 만들면 알림과 `doc_changes_since` 델타가 갈라진다 (SPEC §8).
 *
 * 그래서 묶을 때 접는 축도 `summary` 문자열이 아니라 **구조화된 컬럼**(`changed_paths`,
 * `deleted_paths`, `author`)이다. 문자열을 파싱해서 섹션·증감을 재집계하면 요약 포맷을
 * 바꾸는 날 조용히 깨진다.
 *
 * 순수 함수만 둔다 — DB도 fetch도 없다 (D-008).
 */
import { changesUrl, documentUrl, historyUrl, libraryUrl } from "./url.ts";

export interface PendingEvent {
  author: string | null;
  changed_paths: string[];
  deleted_paths: string[];
  /** 두 줄이다 — 첫 줄이 "경로 — 섹션 (+n −m)", 둘째 줄이 메모 + 작성자 */
  summary: string | null;
}

/**
 * 이 수 이하면 편집을 하나씩 펼친다. 넘으면 문서별로 접는다.
 *
 * 펼치는 게 늘 낫지만 15건을 펼치면 묶은 의미가 없다. 3인 이유: 사람이 스크롤 없이
 * 읽는 한도이고, 실측에서 2건 이상 묶인 묶음의 절반이 3건 이하였다.
 */
const DETAIL_LIMIT = 3;
/** 접었을 때 나열할 문서 수. 넘으면 "외 n개" */
const MAX_PATHS = 8;
const MAX_AUTHORS = 3;

/** `[text](url)`. Mattermost와 Discord 둘 다 이 형태를 렌더한다 */
function link(text: string, url: string): string {
  return `[${text}](${url})`;
}

/**
 * 요약 첫 줄의 경로를 링크로 바꾼다.
 *
 * 첫 줄은 `PLAN.md — …`, `PLAN.md 새 문서 (+40)`, `삭제: PLAN.md` 세 모양인데 어느 쪽이든
 * 경로가 **그대로** 들어 있다. 그래서 모양마다 정규식을 두는 대신 경로 문자열의 첫 등장을
 * 갈아 끼운다. 치환값을 함수로 주는 이유는 경로에 `$`가 들어 있으면 `$&` 같은 치환
 * 패턴으로 해석되기 때문이다.
 */
function linkifyPath(line: string, path: string, url: string): string {
  return line.includes(path) ? line.replace(path, () => link(path, url)) : line;
}

function uniq(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

function authorLine(events: PendingEvent[]): string | null {
  const authors = uniq(events.map((e) => e.author));
  if (authors.length === 0) return null;
  const shown = authors.slice(0, MAX_AUTHORS).join(", ");
  return authors.length > MAX_AUTHORS ? `${shown} 외 ${authors.length - MAX_AUTHORS}명` : shown;
}

/**
 * 보낼 메시지. 보낼 게 없으면 null — 호출부가 "빈 알림"을 쏘지 않게 한다.
 *
 * `events`는 오래된 것부터다. `total`이 더 크면 화면 밖으로 밀린 건수를 적는다.
 */
export function buildNotification(input: {
  base: string;
  slug: string;
  events: PendingEvent[];
  /** 창에 쌓인 전체 건수. 안 주면 events 길이 */
  total?: number;
}): string | null {
  const { base, slug, events } = input;
  if (events.length === 0) return null;

  const total = input.total ?? events.length;
  const head =
    total === 1
      ? `**${link(slug, libraryUrl(base, slug))}**`
      : `**${link(slug, libraryUrl(base, slug))}** · 변경 ${total}건`;

  const body =
    events.length <= DETAIL_LIMIT ? detailBody(base, slug, events) : groupedBody(base, slug, events);

  const footer: string[] = [];
  // 한 건이면 그 문서의 이력이 바로 다음 행동이다. 여러 건이면 어느 이력인지 고를 수 없다.
  const only = events.length === 1 ? [...events[0].changed_paths, ...events[0].deleted_paths][0] : null;
  if (only) footer.push(link("이력", historyUrl(base, slug, only)));
  footer.push(link("변경 목록", changesUrl(base, slug)));

  const dropped = total - events.length;
  const tail = dropped > 0 ? [`…외 ${dropped}건`] : [];

  return [head, "", ...body, ...tail, "", footer.join(" · ")].join("\n");
}

/** 편집을 하나씩 펼친다 — 저장된 요약 두 줄을 그대로 쓰고 경로만 링크로 바꾼다 */
function detailBody(base: string, slug: string, events: PendingEvent[]): string[] {
  const blocks = events.map((event) => {
    const deleted = event.deleted_paths[0];
    const path = event.changed_paths[0] ?? deleted;
    const url = deleted ? historyUrl(base, slug, deleted) : documentUrl(base, slug, path);

    const lines = (event.summary ?? path ?? "").split("\n").filter(Boolean);
    if (lines.length === 0) return path ?? "";
    return [linkifyPath(lines[0], path, url), ...lines.slice(1)].join("\n");
  });
  // 블록 사이를 빈 줄로 띄운다 — 두 줄짜리가 붙어 있으면 어디가 한 편집인지 안 보인다
  return blocks.flatMap((block, i) => (i === 0 ? [block] : ["", block]));
}

/** 문서별로 접는다 — `PLAN.md ×8` */
function groupedBody(base: string, slug: string, events: PendingEvent[]): string[] {
  // 오래된 것부터 훑으므로 마지막에 남는 gone이 그 문서의 최종 상태다.
  // 지웠다 다시 만든 경로를 🗑로 표시하면 아직 없는 문서처럼 보인다.
  const byPath = new Map<string, { count: number; gone: boolean }>();
  for (const event of events) {
    for (const path of event.changed_paths) {
      const entry = byPath.get(path) ?? { count: 0, gone: false };
      byPath.set(path, { count: entry.count + 1, gone: false });
    }
    for (const path of event.deleted_paths) {
      const entry = byPath.get(path) ?? { count: 0, gone: false };
      byPath.set(path, { count: entry.count + 1, gone: true });
    }
  }

  // 많이 고쳐진 문서가 위로. 같으면 경로순 — 순서가 흔들리면 같은 변경도 달라 보인다
  const sorted = [...byPath.entries()].sort(
    (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]),
  );

  const lines = sorted.slice(0, MAX_PATHS).map(([path, { count, gone }]) => {
    const label = link(path, gone ? historyUrl(base, slug, path) : documentUrl(base, slug, path));
    const times = count > 1 ? ` ×${count}` : "";
    return gone ? `🗑 ${label}${times}` : `${label}${times}`;
  });
  if (sorted.length > MAX_PATHS) lines.push(`…외 ${sorted.length - MAX_PATHS}개 문서`);

  const authors = authorLine(events);
  return authors ? [...lines, "", authors] : lines;
}
