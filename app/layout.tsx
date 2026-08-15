import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Link from "next/link";

import { MainNav } from "@/components/MainNav";
import { CONTAINER_CLASS } from "@/components/PageShell";
import { SessionNav } from "@/components/SessionNav";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * 한글 본문 폰트. Geist에는 한글 글리프가 없어서, 이게 없으면 화면의 모든 한글이
 * 시스템 폴백(맑은 고딕 등)으로 렌더된다 — 라틴과 메트릭이 달라 행마다 들쭉거린다.
 * 스택에서 Geist 뒤에 두므로 라틴·숫자는 Geist, 한글만 Pretendard가 받는다.
 * OFL-1.1 (https://github.com/orioncactus/pretendard). next/font/google에는 없어서 셀프호스트.
 */
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cushion",
  description: "스펙 읽기 전용 미러. 에이전트에는 조각으로, 팀에는 변경 알림으로.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${pretendard.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 이름을 붙여 문서 화면 전환에서 고정점이 되게 한다 (globals.css).
            전환이 없는 화면에서는 아무 일도 하지 않는다 */}
        {/* 탐색(로고·문서·대시보드)은 왼쪽, 계정은 오른쪽 — 성격이 다른 것을 양끝으로.
            폭은 CONTAINER_CLASS가 본문(PageShell)과 공유한다 */}
        <header className="border-b" style={{ viewTransitionName: "site-header" }}>
          <nav className={cn(CONTAINER_CLASS, "flex items-center justify-between gap-4 py-3 text-sm")}>
            <div className="flex items-center gap-5">
              <Link href="/" className="font-semibold">
                cushion
              </Link>
              <div className="flex items-center gap-4 text-muted-foreground">
                <MainNav />
              </div>
            </div>
            <div className="flex items-center text-muted-foreground">
              <SessionNav />
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
