import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { SessionNav } from "@/components/SessionNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cushion",
  description: "스펙 읽기 전용 미러. 에이전트에는 조각으로, 팀에는 변경 알림으로.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 이름을 붙여 문서 화면 전환에서 고정점이 되게 한다 (globals.css).
            전환이 없는 화면에서는 아무 일도 하지 않는다 */}
        <header className="border-b" style={{ viewTransitionName: "site-header" }}>
          <nav className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-8 py-3 text-sm">
            <Link href="/" className="font-semibold">
              cushion
            </Link>
            <div className="flex items-center gap-4 text-muted-foreground">
              <Link href="/docs" className="hover:text-foreground">
                문서
              </Link>
              <SessionNav />
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
