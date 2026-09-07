/**
 * @file components/DocsPager.tsx
 * @description 문서 하단의 이전·다음. 사이드바와 같은 순서, 같은 전환 방향을 쓴다.
 *
 * 서버 컴포넌트다 — 현재 위치를 페이지가 직접 알려주므로 `useSelectedLayoutSegment()`가
 * 필요 없다. `transitionTypes`는 직렬화되는 prop이라 서버에서 넘겨도 된다.
 */
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { docsNeighbours } from "@/lib/docs";
import { getDict } from "@/lib/i18n";

interface DocsPagerProps {
  /** 이 페이지의 href. `lib/docs.ts`의 목차 값과 정확히 같아야 한다 */
  current: string;
}

export async function DocsPager({ current }: DocsPagerProps) {
  const t = (await getDict()).docsNav;
  const { previous, next } = docsNeighbours(current, t);

  if (!previous && !next) return null;

  return (
    <nav aria-label={t.pagerLabel} className="mt-14 flex gap-3 border-t pt-6">
      {previous && (
        <Link
          href={previous.href}
          transitionTypes={["docs-back"]}
          className="group flex flex-1 flex-col gap-1 rounded-lg border p-4 text-sm hover:bg-muted/50"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3" /> {t.previous}
          </span>
          <span className="font-medium">{previous.title}</span>
        </Link>
      )}
      {next && (
        <Link
          href={next.href}
          transitionTypes={["docs-forward"]}
          className="group flex flex-1 flex-col items-end gap-1 rounded-lg border p-4 text-sm hover:bg-muted/50"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {t.next} <ArrowRight className="size-3" />
          </span>
          <span className="font-medium">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
