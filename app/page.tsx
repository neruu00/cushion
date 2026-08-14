/**
 * @file app/page.tsx
 * @description 랜딩. 비로그인이 처음 보는 화면이다 — 로그인 상태면 대시보드로 보낸다.
 *
 * 여기 적는 수치는 acceptance §11.1의 실측 문구를 그대로 쓴다. 구체 숫자를 박지 않는
 * 이유는 측정 대상(자기 문서)이 자라면 값이 움직이기 때문이다.
 */
import { ArrowRight, FileText, Radio, Scissors } from "lucide-react";
import { redirect } from "next/navigation";

import { signInWithGoogle } from "@/actions/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { getSessionEmail } from "@/lib/authz";
import { connectCommand, skillsUrl } from "@/lib/snippets";

export default async function LandingPage() {
  if (await getSessionEmail()) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-14 p-8 py-16">
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold leading-tight">
          에이전트를 위한 문서 도서관.
        </h1>
        <p className="max-w-xl text-muted-foreground">
          스펙·ADR·런북·회의록·용어집 — 프로젝트 문서를 한곳에 두고, 에이전트에는 MCP로{" "}
          <strong className="text-foreground">필요한 조각만</strong> 읽고 쓰게 한다. 사람이 아니라
          에이전트를 1차 독자로 삼은 서가다. 같은 문서를 세션마다 컨텍스트에 싣느라 태우는
          토큰이 목적의 전부다.
        </p>
        <form action={signInWithGoogle}>
          <Button type="submit" size="lg">
            Google로 시작하기 <ArrowRight />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          로그인하면 바로 레포를 만들 수 있다. 문서 열람은 레포 멤버만 가능하다.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" /> 한곳에
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            문서의 원본이 여기 있다. 웹에서도, 에이전트의 <code>doc_put</code>으로도 만들고
            고친다. 모든 변경은 이력에 남고 되돌릴 수 있다.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="size-4" /> 조각만
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            목차를 먼저 보고 필요한 <code>##</code> 섹션만 가져간다. 안 바뀐 문서는 본문 대신{" "}
            <code>unchanged</code> 다섯 글자로 끝난다.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="size-4" /> 밀렸을 때만
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            폴링도 상시 연결도 없다. 문서가 바뀌면 다음 응답 끝에 <code>[stale]</code> 한 줄이
            붙고, 팀 채널에는 무엇이 왜 바뀌었는지가 간다.
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2 rounded-lg border bg-muted/30 p-6">
        <p className="text-sm">
          <strong>자기 자신의 문서로 잰 값</strong> — 전량 로드 대비{" "}
          <strong>20% 미만, 5배 이상 절감</strong> (목차 1회 + 작업당 섹션 1개 기준).
        </p>
        <p className="text-xs text-muted-foreground">
          목차는 세션당 한 번이라 작업이 늘수록 더 벌어진다. 수치는 <code>pnpm acceptance</code>가
          그때그때 다시 잰다 — 문서가 자라면 값도 움직이기 때문에 여기 박아 두지 않는다.
        </p>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-medium">붙이는 데 세 단계</h2>
          <p className="text-sm text-muted-foreground">
            레포를 받을 필요도, 환경변수를 심을 필요도 없다. ①만 해도 읽고 쓴다.
          </p>
        </div>
        <OnboardingSteps
          skillsUrl={skillsUrl()}
          connectSlot={
            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
              {connectCommand("cshn_pat_…")}
            </pre>
          }
        />
        <p className="text-xs text-muted-foreground">
          토큰을 발급하면 ①의 명령이 토큰이 박힌 채로 나온다.
        </p>
      </section>

    </main>
  );
}
