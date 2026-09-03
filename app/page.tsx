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

export default async function LandingPage() {
  if (await getSessionEmail()) redirect("/dashboard");

  return (
    <PageShell className="space-y-12 py-14">
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold leading-tight">에이전트를 위한 문서 도서관.</h1>
        <p className="max-w-xl text-muted-foreground">
          스펙과 ADR, 런북, 회의록, 용어집처럼 흩어지기 쉬운 프로젝트 문서를 한곳에 모아 두면,
          에이전트가 MCP로 <strong className="text-foreground">필요한 조각만</strong> 읽고 써요.
          사람이 아니라 에이전트를 1차 독자로 삼아서 설계한 문서 저장소예요. 같은 문서를 세션마다
          통째로 다시 싣느라 소모하는 토큰을 줄이는 것이 Cushion의 유일한 목적이에요.
        </p>
        <p className="max-w-xl text-sm text-muted-foreground">
          Cushion 자신의 문서로 측정해 보면, 문서 전체를 한꺼번에 불러올 때와 비교해서 토큰
          사용량이 <strong className="text-foreground">20% 미만</strong>으로 줄어들어요. 5배 이상
          절감되는 셈이에요.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <form action={signInWithGoogle}>
            <SignInButton hero />
          </form>
          {/* Base UI 버튼은 asChild가 아니라 render로 요소를 갈아끼운다.
              `nativeButton`은 기본값이 true라 <a>를 끼울 때는 꺼야 한다 — 안 끄면
              네이티브 버튼 시맨틱을 잃었다는 경고가 뜬다 */}
          <Button
            render={<Link href="/docs" />}
            nativeButton={false}
            size="lg"
            variant="outline"
          >
            <BookOpen /> 문서 보기
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          로그인하면 바로 라이브러리를 만들 수 있어요. 라이브러리에 담긴 내용은 멤버만 열람할 수
          있지만, 사용법을 설명하는{" "}
          <Link href="/docs" className="underline underline-offset-4">
            문서
          </Link>
          는 로그인하지 않아도 읽을 수 있어요.
        </p>
      </section>

      <section className="space-y-1">
        <CushionDrop />
        <p className="text-center text-xs text-muted-foreground">
          쿠션은 떨어지는 것을 튕겨내지 않고 푹 꺼지면서 받아내요. 에이전트가 컨텍스트에 실어야
          하는 토큰도 Cushion이 그렇게 받아 줘요.
        </p>
      </section>
    </PageShell>
  );
}
