/**
 * @file app/page.tsx
 * @description 랜딩. 비로그인이 처음 보는 화면이다 — 로그인 상태면 대시보드로 보낸다.
 *
 * **설명은 여기서 하지 않는다.** 성질·절약 근거·설치 3단계는 전부 `/docs`에 있고,
 * 랜딩에 사본을 두면 한쪽만 고치는 날이 온다. 여기가 할 일은 셋뿐이다 —
 * 무엇인지 한 문단, 왜 신경 쓸 만한지 한 줄, 그리고 다음 행동 두 개(시작 / 읽기).
 *
 * 히어로 애니메이션은 남긴다. 문서로 대체되는 정보가 아니라 이 화면에만 있는 은유다.
 *
 * 여기 적는 수치는 acceptance §11.1의 실측 문구를 그대로 쓴다. 구체 숫자를 박지 않는
 * 이유는 측정 대상(자기 문서)이 자라면 값이 움직이기 때문이다.
 *
 * **문장이 두 언어로 있다.** 짧은 라벨은 `lib/i18n.*.ts`에 있지만 이 문단들은 중간에
 * `<strong>`이 끼어 있고 어순도 달라서 평문으로 접히지 않는다. 골격(레이아웃·버튼·순서)은
 * 하나만 두고 문단만 언어별로 고른다 — 마크업을 통째로 복제하면 한쪽에만 섹션을 더하는
 * 날이 온다.
 */
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/PageShell";
import { signInWithGoogle } from "@/actions/session";
import { Button } from "@/components/ui/button";
import { CushionDrop } from "@/components/CushionDrop";
import { SignInButton } from "@/components/SignInButton";
import { getSessionEmail } from "@/lib/authz";
import { getI18n, type Locale } from "@/lib/i18n";

interface LandingCopy {
  headline: string;
  lead: React.ReactNode;
  savings: React.ReactNode;
}

export default async function LandingPage() {
  if (await getSessionEmail()) redirect("/dashboard");

  const { locale, t } = await getI18n();
  const copy = LANDING[locale];

  return (
    <PageShell className="space-y-12 py-14">
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold leading-tight">{copy.headline}</h1>
        {/* break-keep = word-break: keep-all. 한국어는 기본값이 글자 단위로 끊겨서
            "에이전트가 MCP로 필요한 조각" 같은 어절이 아무 데서나 잘린다.
            keep-all이면 공백에서만 끊어져 어절이 붙어 다닌다.
            영어에는 아무 영향이 없다 — 원래 공백에서만 끊긴다 */}
        <p className="max-w-xl break-keep text-muted-foreground">{copy.lead}</p>
        <p className="max-w-xl break-keep text-sm text-muted-foreground">{copy.savings}</p>

        <div className="flex flex-wrap items-center gap-3">
          <form action={signInWithGoogle}>
            <SignInButton hero t={t.common} />
          </form>
          {/* Base UI 버튼은 asChild가 아니라 render로 요소를 갈아끼운다.
              `nativeButton`은 기본값이 true라 <a>를 끼울 때는 꺼야 한다 — 안 끄면
              네이티브 버튼 시맨틱을 잃었다는 경고가 뜬다 */}
          <Button render={<Link href="/docs" />} nativeButton={false} size="lg" variant="outline">
            <BookOpen /> {t.landing.viewDocs}
          </Button>
        </div>
      </section>

      <section className="space-y-1">
        <CushionDrop />
        <p className="text-center text-xs text-muted-foreground">{t.landing.dropCaption}</p>
      </section>
    </PageShell>
  );
}

const LANDING: Record<Locale, LandingCopy> = {
  ko: {
    headline: "에이전트를 위한 문서 도서관.",
    lead: (
      <>
        스펙과 ADR, 런북, 회의록을 한곳에 모아 두면 에이전트가 MCP로{" "}
        <strong className="text-foreground">필요한 조각만</strong> 읽고 써요. 같은 문서를 세션마다
        다시 싣느라 소모하는 토큰을 줄이는 것이 목적이에요.
      </>
    ),
    savings: (
      <>
        자체 문서로 측정 해보면 전부 불러올 때보다 토큰을{" "}
        <strong className="text-foreground">5배 이상</strong> 아껴요.
      </>
    ),
  },
  en: {
    headline: "A documentation library built for agents.",
    lead: (
      <>
        Keep your specs, ADRs, runbooks and meeting notes in one place, and an agent reads and
        writes <strong className="text-foreground">only the piece it needs</strong> over MCP. The
        point is to stop burning tokens re-loading the same document every session.
      </>
    ),
    savings: (
      <>
        Measured against our own docs, that is{" "}
        <strong className="text-foreground">over 5× fewer tokens</strong> than loading everything.
      </>
    ),
  },
};
