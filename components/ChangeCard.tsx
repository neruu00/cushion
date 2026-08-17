/**
 * @file components/ChangeCard.tsx
 * @description 변경 하나를 목록의 한 줄로. 라이브러리 화면과 변경 목록 화면이 공유한다.
 *
 * 모양은 `RowCard`가 갖고 있다 — 문서 목록·버전 목록과 같은 줄이어야 하기 때문이다.
 * 여기가 정하는 건 **무엇을 어느 슬롯에 넣을지**와 **어디로 가는지**뿐이다.
 *
 * 어디로 가나: 바뀐 문서가 하나면 그 문서의 이력으로, 여럿이면 변경 목록으로 간다.
 * 여럿일 때 아무 하나를 골라 보내면 나머지가 조용히 사라진다.
 *
 * `sync_events.summary`는 두 줄이다 — 첫 줄이 "경로 — 섹션 (+n −m)", 둘째 줄이
 * 편집 메모다. 첫 줄을 제목으로, 둘째 줄을 부제로 쓴다. 요약을 여기서 다시 만들지
 * 않는다 (알림·MCP 델타와 같은 문자열이어야 한다, SPEC §8).
 */
import { formatDate } from "@/lib/datetime";
import { RowCard } from "@/components/RowCard";

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

  return (
    <RowCard
      href={
        paths.length === 1
          ? `/libraries/${librarySlug}/history/${paths[0]}`
          : `/libraries/${librarySlug}/changes`
      }
      title={headline || paths.join(", ") || "요약 없음"}
      subtitle={
        rest.length > 0
          ? // 둘째 줄 끝에 " — 작성자"가 붙어 있다. 오른쪽에 이미 있으므로 떼어낸다
            rest.join(" ").replace(/\s*—\s*[^—]*$/, "")
          : undefined
      }
      meta={
        <>
          {event.author ? <span className="block max-w-40 truncate">{event.author}</span> : null}
          <span className="block">{formatDate(event.created_at)}</span>
        </>
      }
    />
  );
}
