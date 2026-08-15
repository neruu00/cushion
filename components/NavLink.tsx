"use client";

/**
 * @file components/NavLink.tsx
 * @description 현재 위치를 아는 헤더 링크. 활성 표시가 없으면 지금 어느 화면인지
 * 헤더만 봐서는 알 수 없다.
 *
 * 하위 경로도 활성으로 친다 — /docs/usage에 있어도 "문서"는 켜져 있어야 한다.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("hover:text-foreground", active && "font-medium text-foreground")}
    >
      {children}
    </Link>
  );
}
