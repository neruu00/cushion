/**
 * @file app/docs/layout.tsx
 * @description 문서 셸. 사이드바는 이동해도 살아남고, 본문만 바뀐다.
 *
 * **비로그인도 본다.** 설치 안내가 로그인보다 먼저 필요하기 때문이다 —
 * 여기서 권한을 묻지 않는다.
 *
 * 사이드바에 `viewTransitionName`을 주고 CSS로 애니메이션을 끈다. 이름이 없으면
 * 루트 스냅샷에 섞여 본문과 함께 미끄러지는데, 그러면 화면 전체가 움직인 것처럼
 * 보여 어디가 바뀐 건지 알 수 없다. 고정점이 하나는 있어야 한다.
 */
import type { Metadata } from "next";

import { DocsNav } from "@/components/DocsNav";

export const metadata: Metadata = {
  title: { template: "%s · Cushion 문서", default: "Cushion 문서" },
};

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-x-10 gap-y-6 p-8 py-12 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start">
      <aside
        style={{ viewTransitionName: "docs-sidebar" }}
        className="md:sticky md:top-8"
      >
        <DocsNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </main>
  );
}
