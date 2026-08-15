"use client";

/**
 * @file components/UserMenu.tsx
 * @description 헤더 오른쪽 끝의 계정 메뉴. 트리거가 이메일 자체다 —
 * 누가 로그인했는지와 계정 메뉴 입구가 한 자리에 있다.
 *
 * 구글 프로필 사진·이름은 쓰지 않는다. `lib/auth.ts`가 세션 쿠키에 이메일만 남기는
 * 결정과 맞물려 있다 — 사진을 되살리려면 그 결정부터 뒤집어야 한다.
 *
 * 로그아웃이 폼인 이유: CSRF 보호되는 POST여야 한다 (T-501). 링크로 바꾸지 말 것.
 * 서버 액션은 서버 컴포넌트(SessionNav)에서 prop으로 받는다.
 */
import Link from "next/link";
import { ChevronDown, LogOut, KeyRound, ShieldCheck } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  email: string;
  isAdmin: boolean;
  signOutAction: () => Promise<void>;
}

export function UserMenu({ email, isAdmin, signOutAction }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex cursor-pointer items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-foreground">
        <span className="hidden font-mono text-xs sm:inline">{email}</span>
        {/* 좁은 화면에서는 이메일이 헤더를 다 먹는다 — 앞부분만 남긴다 */}
        <span className="font-mono text-xs sm:hidden">{email.split("@")[0]}</span>
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-44">
        {isAdmin && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <ShieldCheck /> 관리
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href="/settings/tokens" />}>
          <KeyRound /> 토큰
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <form action={signOutAction}>
          {/* Menu.Item의 기본 렌더는 <div>라 nativeButton 기본값이 false다.
              <button>을 끼울 때는 켜 줘야 한다 — Button과 정확히 반대 방향의 함정 */}
          <DropdownMenuItem
            variant="destructive"
            nativeButton
            render={<button type="submit" className="w-full" />}
          >
            <LogOut /> 로그아웃
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
