import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { signInWithGoogle, signOutEverywhere } from "@/actions/session";
import { getSessionEmail, isAdminEmail } from "@/lib/authz";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const email = await getSessionEmail();

  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b">
          <nav className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-8 py-3 text-sm">
            <Link href="/" className="font-semibold">
              cushion
            </Link>
            <div className="flex items-center gap-4 text-muted-foreground">
              {email ? (
                <>
                  <Link href="/dashboard" className="hover:text-foreground">
                    대시보드
                  </Link>
                  {/* 링크가 보이는 것과 들어갈 수 있는 것은 별개다. 실제 판정은 각 페이지가 한다 */}
                  {isAdminEmail(email) && (
                    <Link href="/admin" className="hover:text-foreground">
                      관리
                    </Link>
                  )}
                  <Link href="/settings/tokens" className="hover:text-foreground">
                    토큰
                  </Link>
                  <span className="hidden font-mono text-xs sm:inline">{email}</span>
                  <form action={signOutEverywhere}>
                    <button type="submit" className="cursor-pointer hover:text-foreground">
                      로그아웃
                    </button>
                  </form>
                </>
              ) : (
                <form action={signInWithGoogle}>
                  <button type="submit" className="cursor-pointer hover:text-foreground">
                    로그인
                  </button>
                </form>
              )}
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
