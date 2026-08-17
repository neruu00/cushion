/**
 * @file components/RowCard.tsx
 * @description 목록의 한 줄. 문서·변경·버전이 **같은 모양**을 쓰도록 여기 하나로 모았다.
 *
 * 왼쪽에 제목(mono)과 부제, 오른쪽에 메타. 화면마다 다시 조립하면 여백과 잘림 규칙이
 * 조금씩 갈리고, 나란히 놓였을 때 그게 그대로 보인다.
 *
 * **카드 전체가 링크다.** 안에 링크를 여러 개 심으면 어디를 눌러야 할지가 매번 다르고,
 * 링크 안의 링크는 중첩이 안 돼 카드 전체를 누를 수 없게 된다.
 *
 * `min-w-0`이 왼쪽에 있어야 `truncate`가 동작한다 — flex 자식의 기본 min-width가 auto라
 * 내용이 길면 줄어들지 않고 오른쪽 메타를 밀어낸다.
 */
import Link from "next/link";

interface RowCardProps {
  href: string;
  /** 한 줄로 잘린다. 식별자 성격이라 mono다 */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** 오른쪽 끝. 작성자·날짜처럼 짧은 것 */
  meta?: React.ReactNode;
}

export function RowCard({ href, title, subtitle, meta }: RowCardProps) {
  return (
    <Link
      href={href}
      className="flex items-start justify-between gap-4 px-3 py-2 hover:bg-muted/40"
    >
      <span className="min-w-0">
        <span className="block truncate font-mono text-sm">{title}</span>
        {subtitle ? (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {meta ? (
        <span className="shrink-0 text-right text-xs text-muted-foreground">{meta}</span>
      ) : null}
    </Link>
  );
}
