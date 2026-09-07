import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

import { setLocale } from "@/actions/locale";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { MainNav } from "@/components/MainNav";
import { CONTAINER_CLASS } from "@/components/PageShell";
import { SessionNav } from "@/components/SessionNav";
import { UiCopyProvider } from "@/components/UiCopyProvider";
import { getDict, getI18n } from "@/lib/i18n";
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
 *
 * **`preload: false`가 의도된 것이다.** 이 파일은 2MB이고 영어 화면에는 한글이 한 자도
 * 없다 — 기본값(`preload: true`)이면 `<link rel="preload">`가 박혀서 절대 쓰지 않을
 * 폰트를 모든 영어 방문자가 받는다. 끄면 브라우저가 실제로 한글 글리프를 그려야 할 때만
 * 받아 온다(라틴은 스택 앞의 Geist가 덮는다).
 *
 * ⚠️ 스택에서 빼는 방식으로는 못 고친다. `globals.css`의 `--font-sans`가
 *    `var(--font-pretendard)`를 참조하므로 변수가 없으면 **선언 전체가 무효**가 되어
 *    폰트 지정이 통째로 날아간다. 그래서 변수는 언제나 붙이고 preload만 끈다.
 */
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return { title: "Cushion", description: t.meta.description };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, t } = await getI18n();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${pretendard.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 이름을 붙여 문서 화면 전환에서 고정점이 되게 한다 (globals.css).
            전환이 없는 화면에서는 아무 일도 하지 않는다 */}
        {/* 탐색(로고·문서)은 왼쪽, 언어·계정은 오른쪽 — 성격이 다른 것을 양끝으로.
            폭은 CONTAINER_CLASS가 본문(PageShell)과 공유한다 */}
        <header className="border-b" style={{ viewTransitionName: "site-header" }}>
          <nav
            className={cn(CONTAINER_CLASS, "flex items-center justify-between gap-4 py-3 text-sm")}
          >
            <MainNav />
            <div className="flex items-center gap-3 text-muted-foreground">
              <LocaleSwitch locale={locale} t={t.nav} setLocaleAction={setLocale} />
              <SessionNav />
            </div>
          </nav>
        </header>
        {/* 공용 문구(버튼·복사·확인)만 내려 준다. 화면별 문구는 각 페이지가 props로 준다 */}
        <UiCopyProvider value={{ common: t.common, form: t.form }}>{children}</UiCopyProvider>
      </body>
    </html>
  );
}
