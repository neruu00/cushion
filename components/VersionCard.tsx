/**
 * @file components/VersionCard.tsx
 * @description 이력 목록의 한 줄. 변경 카드와 **같은 모양**(`RowCard`)이다.
 *
 * **본문(`content`)을 받지 않는다.** 이력 목록이 무거웠던 이유가 그것이다 — 버전 하나가
 * 평균 18KB라 50개면 900KB를 실어 나른다. 목록은 sha·메모·작성자·시각만 있으면 되고,
 * 본문과 diff는 눌렀을 때 상세 화면이 그 버전 하나만 가져온다.
 *
 * 제목이 sha인 이유: 이 화면은 한 문서의 이력이라 경로가 매 줄 같다. 줄을 구분하는 건
 * 시각과 sha뿐이고, sha는 되돌리기·충돌에서 실제로 쓰는 식별자다 (git의 커밋 해시와 같다).
 */
import { formatDateTime } from "@/lib/datetime";
import { RowCard } from "@/components/RowCard";

export interface VersionSummary {
  id: number;
  content_sha: string;
  author: string;
  note: string | null;
  created_at: string;
}

interface VersionCardProps {
  version: VersionSummary;
  href: string;
}

export function VersionCard({ version, href }: VersionCardProps) {
  return (
    <RowCard
      href={href}
      title={version.content_sha.slice(0, 8)}
      subtitle={version.note ?? "메모 없음"}
      meta={
        <>
          <span className="block max-w-40 truncate">{version.author}</span>
          <span className="block">{formatDateTime(version.created_at)}</span>
        </>
      }
    />
  );
}
