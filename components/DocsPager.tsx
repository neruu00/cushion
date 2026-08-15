/**
 * @file components/DocsPager.tsx
 * @description 문서 하단의 이전·다음. 사이드바와 같은 순서, 같은 전환 방향을 쓴다.
 *
 * 서버 컴포넌트다 — 현재 위치를 페이지가 직접 알려주므로 `useSelectedLayoutSegment()`가
 * 필요 없다. `transitionTypes`는 직렬화되는 prop이라 서버에서 넘겨도 된다.
 */
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { DOCS_PAGES } from "@/lib/docs";

interface DocsPagerProps {
  /** 이 페이지의 href. `DOCS_PAGES`의 값과 정확히 같아야 한다 */
  current: string;
}

export function DocsPager({ current }: DocsPagerProps) {
  const index = DOCS_PAGES.findIndex((page) => page.href === current);
  const previous = index > 0 ? DOCS_PAGES[index - 1] : null;
  const next = index >= 0 && index < DOCS_PAGES.length - 1 ? DOCS_PAGES[index + 1] : null;

  if (!previous && !next) return null;

  return (
    <nav aria-label="이전·다음 문서" className="mt-14 flex gap-3 border-t pt-6">
      {previous && (
        <Link
          href={previous.href}
          transitionTypes={["docs-back"]}
          className="group flex flex-1 flex-col gap-1 rounded-lg border p-4 text-sm hover:bg-muted/50"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="size-3" /> 이전
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
            다음 <ArrowRight className="size-3" />
          </span>
          <span className="font-medium">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
