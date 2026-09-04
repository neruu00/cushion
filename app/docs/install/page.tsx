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

import type { ConnectGroup } from "@/components/ConnectTabs";
import { ConnectTabs } from "@/components/ConnectTabs";
import { DocsPager } from "@/components/DocsPager";
import { DocsTransition } from "@/components/DocsTransition";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { antigravityConfig, codexConfig, codexEnvExport, connectCommand, skillsUrl } from "@/lib/snippets";

export const metadata: Metadata = { title: "설치" };

const PLACEHOLDER_TOKEN = "cshn_pat_…";

// 실제 토큰이 채워진 버전은 /settings/tokens 발급 직후에만 나온다(SecretPayload는 1회 노출).
// 여기 목록은 actions/token.ts가 발급 시 만드는 것과 같은 모양이다 — 한쪽만 고치는 날이
// 오지 않게, 클라이언트·항목 구성을 그쪽과 맞춰 둔다.
const CONNECT_GROUPS: ConnectGroup[] = [
  {
    key: "claude",
    label: "Claude Code",
    items: [{ label: "셸에서 한 번 실행", content: connectCommand(PLACEHOLDER_TOKEN) }],
  },
  {
    key: "antigravity",
    label: "Antigravity",
    items: [
      {
        // 개인 연결은 항상 저장소 밖(전역) 경로만 준다 — 프로젝트 스코프
        // (.agents/mcp_config.json)는 저장소 안에 토큰이 그대로 박힌다. headers가
        // 환경변수 치환을 지원하는지 확인이 안 돼 .mcp.json처럼 시크릿을 뺄 수도 없어서,
        // 커밋 위험을 원천 차단하려면 여기서 그 경로를 아예 안 주는 게 맞다.
        label: "~/.gemini/config/mcp_config.json 에 추가 (url이 아니라 serverUrl 키예요)",
        content: antigravityConfig(PLACEHOLDER_TOKEN),
      },
    ],
  },
  {
    key: "codex",
    label: "Codex CLI",
    items: [
      {
        label: "먼저 셸 프로필(.zshrc 등)에 추가",
        content: codexEnvExport(PLACEHOLDER_TOKEN),
      },
      {
        label: "~/.codex/config.toml에 추가 (토큰을 직접 넣지 않고 환경변수 이름만 가리켜요)",
        content: codexConfig(),
      },
    ],
  },
];

export default function DocsInstallPage() {
  return (
    <DocsTransition>
      <article className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">설치</h1>
          <p className="text-muted-foreground">
            토큰 하나만 있으면 연결할 수 있어요. ①만 마쳐도 에이전트가 문서를 읽고 써요.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">먼저 토큰 받기</h2>
          <p className="text-sm text-muted-foreground">
            <Link href="/settings/tokens" className="underline underline-offset-4">
              /settings/tokens
            </Link>
            에서 발급하면 아래 ①의 스니펫이{" "}
            <strong className="text-foreground">토큰이 채워진 채로</strong> 클라이언트별로 나와요.
            토큰은 그때 한 번만 보여요. 서버에는 sha256 해시만 남아서 다시 꺼낼 수 없고,
            잃어버리면 재발급해야 해요.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">연결하는 세 단계</h2>
          <p className="text-sm text-muted-foreground">
            Cushion 서버는 URL과 <code>Authorization: Bearer</code> 헤더만 있으면 되는 Streamable
            HTTP 서버라 <strong className="text-foreground">클라이언트를 가리지 않아요.</strong>{" "}
            ①에서 쓰는 클라이언트를 고르세요. ③은 어떤 클라이언트를 쓰든 같아요.
          </p>
          <OnboardingSteps
            skillsUrl={skillsUrl()}
            connectSlot={<ConnectTabs groups={CONNECT_GROUPS} />}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">③이 가장 안 보이지만 가장 중요해요</h2>
          <p className="text-sm text-muted-foreground">
            로컬에 문서가 없는 것이 이 구조의 정상 상태라, 에이전트는 표시가 없으면 그냥
            지나가요. <code>AGENTS.md</code>의 한 줄이{" "}
            <strong className="text-foreground">Cushion을 찾게 만드는 유일한 신호</strong>이고,{" "}
            <code>/cushion-use</code>가 그 줄을 대신 넣어 줘요.
          </p>
          <p className="text-sm text-muted-foreground">
            팀원이 이미 <code>AGENTS.md</code>를 커밋해 뒀다면 합류하는 사람은 ①만 마치면 돼요.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">팀 전체에 배포할 때</h2>
          <p className="text-sm text-muted-foreground">
            개인 연결은 위 세 단계로 끝나요. 레포에 커밋해 팀 전원에게 배포하려면 라이브러리
            설정에서 <code>.mcp.json</code> 스니펫을 받으세요.{" "}
            <strong className="text-foreground">그 파일에는 토큰을 넣지 않아요.</strong> 커밋되는
            파일이라 환경변수 확장(<code>{"${CUSHION_TOKEN}"}</code>)을 써요.
          </p>
          <p className="text-sm text-muted-foreground">
            프로젝트 스코프 설정은 user 스코프를 덮어써요. 개인이 이미 연결해 둔 상태에서{" "}
            <code>.mcp.json</code>만 받으면 <code>CUSHION_TOKEN</code> 없이는 그 프로젝트
            안에서만 401이 나요.
          </p>
        </section>

        <DocsPager current="/docs/install" />
      </article>
    </DocsTransition>
  );
}
