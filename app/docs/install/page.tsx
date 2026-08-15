/**
 * @file app/docs/install/page.tsx
 * @description 문서 — 설치. 3단계는 `OnboardingSteps`를 **그대로** 재사용한다.
 *
 * 안내를 여기 다시 쓰지 않는 이유는 SPEC §9에 있다 — 화면마다 따로 쓰면 한쪽만 고치는
 * 날이 온다. 랜딩·토큰 화면과 같은 컴포넌트를 쓰므로 여기도 자동으로 따라온다.
 *
 * 1단계 슬롯에는 랜딩과 같은 자리표시 명령을 넣는다. 진짜 토큰이 박힌 명령은
 * `/settings/tokens`에서만 나온다 — 토큰은 발급 직후 1회만 노출되기 때문이다.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { DocsPager } from "@/components/DocsPager";
import { DocsTransition } from "@/components/DocsTransition";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { connectCommand, skillsUrl } from "@/lib/snippets";

export const metadata: Metadata = { title: "설치" };

export default function DocsInstallPage() {
  return (
    <DocsTransition>
      <article className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">설치</h1>
          <p className="text-muted-foreground">
            레포를 클론할 필요도, 환경변수를 설정할 필요도 없어요. ①만 해도 읽고 써요.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">먼저 토큰 받기</h2>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings/tokens" className="underline underline-offset-4">
              /settings/tokens
            </Link>
            에서 발급하면 아래 ①의 명령이 <strong className="text-foreground">토큰이 채워진 채로</strong>{" "}
            나와요. 토큰은 그때 한 번만 보여요 — 서버에는 sha256 해시만 저장돼서 다시 꺼낼 수
            없고, 잃어버리면 재발급해야 해요(재발급하면 이전 토큰은 즉시 무효가 돼요).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">연결하는 세 단계</h2>
          <OnboardingSteps
            skillsUrl={skillsUrl()}
            connectSlot={
              <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                {connectCommand("cshn_pat_…")}
              </pre>
            }
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">③이 가장 안 보이지만 가장 중요해요</h2>
          <p className="text-sm text-muted-foreground">
            로컬에 문서가 없는 게 이 구조의 정상 상태예요. 그래서 에이전트는 아무 표시가 없으면
            “문서가 없네” 하고 그냥 지나가요. <code>AGENTS.md</code>의 한 줄이{" "}
            <strong className="text-foreground">유일한 방아쇠</strong>고,{" "}
            <code>/cushion-use</code>가 그 줄을 넣어 줘요.
          </p>
          <p className="text-sm text-muted-foreground">
            팀원이 이미 <code>AGENTS.md</code>를 커밋해 뒀다면 합류하는 사람은 ①만 하면 돼요.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">팀 전체에 배포할 때</h2>
          <p className="text-sm text-muted-foreground">
            개인 연결은 위 3단계로 끝나요. 레포에 커밋해 팀 전원에게 배포하고 싶다면 라이브러리
            화면의 설정에서 <code>.mcp.json</code> 스니펫을 받으세요.{" "}
            <strong className="text-foreground">거기에는 토큰을 넣지 않아요</strong> — 커밋되는
            파일이라 환경변수 확장(<code>{"${CUSHION_TOKEN}"}</code>)을 써요.
          </p>
          <p className="text-sm text-muted-foreground">
            주의할 게 하나 있어요. 프로젝트 스코프 설정은 user 스코프를 덮어서, 개인이 이미 연결해 둔
            상태에서 <code>.mcp.json</code>만 받으면 <code>CUSHION_TOKEN</code> 없이는 그 프로젝트
            안에서만 401이 나요.
          </p>
        </section>

        <DocsPager current="/docs/install" />
      </article>
    </DocsTransition>
  );
}
