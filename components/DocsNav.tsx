"use client";

/**
 * @file components/DocsNav.tsx
 * @description 문서 사이드바. 현재 위치 표시와 전환 방향을 함께 낸다.
 *
 * 클라이언트인 이유가 둘 다 있다 — `useSelectedLayoutSegment()`로 현재 문서를 알아야
 * 하고, 그 인덱스로 **이동 방향**(`transitionTypes`)을 계산해야 한다. 서버에서는
 * 레이아웃이 현재 경로를 알 수 없다.
 *
 * 방향은 목차 순서로 정한다: 아래로 가면 `docs-forward`, 위로 가면 `docs-back`.
 * 자기 자신을 가리키는 링크에는 방향을 주지 않는다 — 제자리인데 미끄러지면 거짓말이다.
 */
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { DOCS_PAGES, docsIndexOf } from "@/lib/docs";
import { cn } from "@/lib/utils";

export function DocsNav() {
  const current = docsIndexOf(useSelectedLayoutSegment());

  return (
    // 모바일은 가로 칩 한 줄이다. 세로로 쌓으면 목차 4개가 첫 화면을 다 차지해서
    // 본문이 스크롤 밑으로 밀린다. summary도 모바일에서는 접는다 — 칩이 문장이 되면 줄이 넘친다.
    <nav aria-label="문서 목차">
      <ul className="flex gap-1.5 overflow-x-auto pb-1 md:block md:space-y-1 md:pb-0">
        {DOCS_PAGES.map((page, index) => {
          const active = index === current;
          return (
            <li key={page.href} className="shrink-0">
              <Link
                href={page.href}
                aria-current={active ? "page" : undefined}
                transitionTypes={
                  active ? undefined : [index > current ? "docs-forward" : "docs-back"]
                }
                className={cn(
                  "block rounded-md px-3 py-1.5 text-sm transition-colors md:py-2",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {page.title}
                <span className="mt-0.5 hidden text-xs font-normal text-muted-foreground md:block">
                  {page.summary}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
