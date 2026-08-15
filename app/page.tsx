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
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signInWithGoogle } from "@/actions/session";
import { Button } from "@/components/ui/button";
import { CushionDrop } from "@/components/CushionDrop";
import { getSessionEmail } from "@/lib/authz";

export default async function LandingPage() {
  if (await getSessionEmail()) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-12 p-8 py-16">
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold leading-tight">에이전트를 위한 문서 도서관.</h1>
        <p className="max-w-xl text-muted-foreground">
          스펙·ADR·런북·회의록·용어집 — 프로젝트 문서를 한곳에 두고, 에이전트에는 MCP로{" "}
          <strong className="text-foreground">필요한 조각만</strong> 읽고 쓰게 한다. 사람이 아니라
          에이전트를 1차 독자로 삼은 서가다. 같은 문서를 세션마다 컨텍스트에 싣느라 태우는 토큰이
          목적의 전부다.
        </p>
        <p className="max-w-xl text-sm text-muted-foreground">
          자기 자신의 문서로 재면 전량 로드 대비{" "}
          <strong className="text-foreground">20% 미만 — 5배 이상 절감</strong>이다.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <form action={signInWithGoogle}>
            <Button type="submit" size="lg">
              Google로 시작하기 <ArrowRight />
            </Button>
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
          로그인하면 바로 레포를 만들 수 있다. 문서 열람은 레포 멤버만 가능하다.{" "}
          <Link href="/docs" className="underline underline-offset-4">
            문서
          </Link>
          는 로그인 없이 읽을 수 있다.
        </p>
      </section>

      <section className="space-y-1">
        <CushionDrop />
        <p className="text-center text-xs text-muted-foreground">
          떨어지는 것을 튕겨내지 않고 푹 꺼지며 삼키듯 — 에이전트가 컨텍스트에 태울 토큰을 Cushion이
          흡수한다.
        </p>
      </section>
    </main>
  );
}
