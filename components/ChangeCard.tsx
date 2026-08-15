/**
 * @file components/ChangeCard.tsx
 * @description 변경 하나를 문서 목록과 **같은 모양**의 카드로. 라이브러리 화면과
 * 변경 목록 화면이 공유한다.
 *
 * 카드 전체가 링크다 — 안에 링크를 여러 개 심으면 어디를 눌러야 할지가 매번 다르고,
 * 링크 안에 링크는 중첩이 불가능해서 카드 전체를 누를 수도 없다.
 *
 * 어디로 가나: 바뀐 문서가 하나면 그 문서의 이력으로, 여럿이면 변경 목록으로 간다.
 * 여럿일 때 아무 하나를 골라 보내면 나머지가 조용히 사라진다.
 *
 * `sync_events.summary`는 두 줄이다 — 첫 줄이 "경로 — 섹션 (+n −m)", 둘째 줄이
 * 편집 메모다. 카드에서는 첫 줄을 제목으로, 둘째 줄을 부제로 쓴다. 요약을 여기서
 * 다시 만들지 않는다 (알림·MCP 델타와 같은 문자열이어야 한다, SPEC §8).
 */
import Link from "next/link";

export interface ChangeEvent {
  id: number;
  summary: string | null;
  author: string | null;
  created_at: string;
  changed_paths: string[] | null;
  deleted_paths: string[] | null;
}

interface ChangeCardProps {
  event: ChangeEvent;
  librarySlug: string;
}

export function ChangeCard({ event, librarySlug }: ChangeCardProps) {
  const paths = [...(event.changed_paths ?? []), ...(event.deleted_paths ?? [])];
  const [headline, ...rest] = (event.summary ?? "").split("\n");

  const href =
    paths.length === 1
      ? `/libraries/${librarySlug}/history/${paths[0]}`
      : `/libraries/${librarySlug}/changes`;

  return (
    <Link
      href={href}
      className="flex items-start justify-between gap-4 px-3 py-2 hover:bg-muted/40"
    >
      <span className="min-w-0">
        <span className="block truncate font-mono text-sm">
          {headline || paths.join(", ") || "요약 없음"}
        </span>
        {rest.length > 0 ? (
          <span className="block truncate text-xs text-muted-foreground">
            {/* 둘째 줄 끝에 " — 작성자"가 붙어 있다. 오른쪽에 이미 있으므로 떼어낸다 */}
            {rest.join(" ").replace(/\s*—\s*[^—]*$/, "")}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-right text-xs text-muted-foreground">
        {event.author ? <span className="block max-w-40 truncate">{event.author}</span> : null}
        <span className="block">{event.created_at.slice(0, 10)}</span>
      </span>
    </Link>
  );
}
