/**
 * @file components/MainNav.tsx
 * @description 헤더 왼쪽 — 로고와 탐색 링크.
 *
 * **로고가 곧 대시보드 입구다.** 로그인했으면 `/dashboard`로, 아니면 랜딩으로 간다.
 * 전에는 "대시보드" 링크를 따로 뒀는데, 로고를 눌러도 어차피 `/`가 대시보드로
 * 리다이렉트하고 있어서 같은 곳으로 가는 입구가 헤더에 두 개였다. 하나로 줄이고
 * 리다이렉트도 건너뛴다.
 *
 * 로고까지 이 컴포넌트가 들고 있는 이유: 목적지가 로그인 여부로 갈리는데, 세션을 읽는
 * 곳은 여기다. 레이아웃에 두면 그 분기가 레이아웃으로 샌다.
 */
import Link from "next/link";

import { NavLink } from "@/components/NavLink";
import { getSessionEmail } from "@/lib/authz";
import { getDict } from "@/lib/i18n";

export async function MainNav() {
  const email = await getSessionEmail();
  const t = await getDict();

  return (
    <div className="flex items-center gap-5">
      <Link
        href={email ? "/dashboard" : "/"}
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        cushion
      </Link>
      <div className="flex items-center gap-4 text-muted-foreground">
        <NavLink href="/docs">{t.nav.docs}</NavLink>
      </div>
    </div>
  );
}
