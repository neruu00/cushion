/**
 * @file app/docs/install/page.tsx
 * @description 문서 — 설치. 3단계는 `OnboardingSteps`를 **그대로** 재사용한다.
 *
 * 안내를 여기 다시 쓰지 않는 이유는 SPEC §9에 있다 — 화면마다 따로 쓰면 한쪽만 고치는
 * 날이 온다. 랜딩·토큰 화면과 같은 컴포넌트를 쓰므로 여기도 자동으로 따라온다.
 *
 * 1단계 슬롯에는 랜딩과 같은 자리표시 명령을 넣는다. 진짜 토큰이 박힌 명령은
 * `/settings/tokens`에서만 나온다 — 토큰은 발급 직후 1회만 노출되기 때문이다.
 *
 * 플러그인 두 줄은 그 슬롯 **밖**에 둔다. ①(연결)과 ②(스킬 설치)를 한꺼번에 하므로
 * 1단계 안에 넣으면 "①을 했으니 ②도 해야 한다"로 읽힌다. 그리고 스니펫에 토큰이 없어서
 * (`plugin install`이 물어본다) 발급 직후가 아닌 이 화면에도 완전한 형태로 놓을 수 있다.
 *
 * 연결 스니펫의 **라벨**은 여기 `COPY`에 있고 `lib/i18n.*.ts`에는 없다. 같은 파일을 가리키는
 * 라벨이라도 이 화면은 설명이 한 겹 더 붙어서(`serverUrl 키예요`) 토큰 발급 화면 것과 다르다 —
 * 한 키를 공유시키면 한쪽 문장이 다른 쪽에서 어색해진다.
 */
import type { Metadata } from "next";
import Link from "next/link";

import type { ConnectGroup } from "@/components/ConnectTabs";
import { ConnectTabs } from "@/components/ConnectTabs";
import { CopyBlock } from "@/components/CopyBlock";
import { DocsPager } from "@/components/DocsPager";
import { DocsTransition } from "@/components/DocsTransition";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { getI18n, type Locale } from "@/lib/i18n";
import {
  antigravityConfig,
  codexConfig,
  codexEnvExport,
  connectCommand,
  pluginCommands,
  skillsUrl,
} from "@/lib/snippets";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: COPY[locale].title };
}

const PLACEHOLDER_TOKEN = "cshn_pat_…";

interface InstallCopy {
  title: string;
  lead: React.ReactNode;
  tokenHeading: string;
  tokenBody: React.ReactNode;
  pluginHeading: string;
  pluginLead: React.ReactNode;
  pluginCopyLabel: string;
  pluginToken: React.ReactNode;
  pluginPrefix: React.ReactNode;
  pluginAlt: React.ReactNode;
  stepsHeading: string;
  stepsLead: React.ReactNode;
  thirdHeading: string;
  third1: React.ReactNode;
  third2: React.ReactNode;
  teamHeading: string;
  team1: React.ReactNode;
  team2: React.ReactNode;
  connect: {
    claudeShell: string;
    antigravity: string;
    codexProfile: string;
    codexConfig: string;
  };
}

/**
 * 실제 토큰이 채워진 버전은 /settings/tokens 발급 직후에만 나온다(SecretPayload는 1회 노출).
 * 여기 목록은 actions/token.ts가 발급 시 만드는 것과 같은 모양이다 — 한쪽만 고치는 날이
 * 오지 않게, 클라이언트·항목 구성을 그쪽과 맞춰 둔다.
 */
function connectGroups(c: InstallCopy["connect"]): ConnectGroup[] {
  return [
    {
      key: "claude",
      label: "Claude Code",
      items: [{ label: c.claudeShell, content: connectCommand(PLACEHOLDER_TOKEN) }],
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
          label: c.antigravity,
          content: antigravityConfig(PLACEHOLDER_TOKEN),
        },
      ],
    },
    {
      key: "codex",
      label: "Codex CLI",
      items: [
        { label: c.codexProfile, content: codexEnvExport(PLACEHOLDER_TOKEN) },
        { label: c.codexConfig, content: codexConfig() },
      ],
    },
  ];
}

export default async function DocsInstallPage() {
  const { locale } = await getI18n();
  const c = COPY[locale];

  return (
    <DocsTransition>
      <article className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="text-muted-foreground">{c.lead}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.tokenHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.tokenBody}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">{c.pluginHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.pluginLead}</p>
          <CopyBlock value={pluginCommands()} label={c.pluginCopyLabel} />
          <p className="text-sm text-muted-foreground">{c.pluginToken}</p>
          <p className="text-sm text-muted-foreground">{c.pluginPrefix}</p>
          <p className="text-sm text-muted-foreground">{c.pluginAlt}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">{c.stepsHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.stepsLead}</p>
          <OnboardingSteps
            skillsUrl={skillsUrl()}
            connectSlot={<ConnectTabs groups={connectGroups(c.connect)} />}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.thirdHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.third1}</p>
          <p className="text-sm text-muted-foreground">{c.third2}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.teamHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.team1}</p>
          <p className="text-sm text-muted-foreground">{c.team2}</p>
        </section>

        <DocsPager current="/docs/install" />
      </article>
    </DocsTransition>
  );
}

const COPY: Record<Locale, InstallCopy> = {
  ko: {
    title: "설치",
    lead: <>토큰 하나만 있으면 연결할 수 있어요. ①만 마쳐도 에이전트가 문서를 읽고 써요.</>,
    tokenHeading: "먼저 토큰 받기",
    tokenBody: (
      <>
        <Link href="/settings/tokens" className="underline underline-offset-4">
          /settings/tokens
        </Link>
        에서 발급하면 아래 ①의 스니펫이{" "}
        <strong className="text-foreground">토큰이 채워진 채로</strong> 클라이언트별로 나와요.
        토큰은 그때 한 번만 보여요. 서버에는 sha256 해시만 남아서 다시 꺼낼 수 없고, 잃어버리면
        재발급해야 해요.
      </>
    ),
    pluginHeading: "Claude Code면 두 줄로 끝나요",
    pluginLead: (
      <>
        플러그인이 <strong className="text-foreground">서버 설정과 스킬을 함께</strong> 들고 와요.
        아래 세 단계 중 ①과 ②를 이 두 줄이 대신하니까, 남는 건 ③ 하나예요.
      </>
    ),
    pluginCopyLabel: "Claude Code 안에서 차례로 입력하세요",
    pluginToken: (
      <>
        토큰은 <code>install</code> 도중에 물어봐요. 붙여넣으면 Claude Code의 보안 저장소로 들어가서{" "}
        <strong className="text-foreground">설정 파일에 평문으로 남지 않아요</strong> — ①의 명령보다
        이쪽이 안전한 이유예요.
      </>
    ),
    pluginPrefix: (
      <>
        플러그인으로 들어온 스킬은 이름 앞에 플러그인 이름이 붙어요. ③에서 <code>/cushion-use</code>{" "}
        대신 <code>/cushion:cushion-use</code>를 쓰세요. 나머지도 마찬가지로{" "}
        <code>/cushion:cushion-new</code>처럼 불러요.
      </>
    ),
    pluginAlt: (
      <>
        Antigravity·Codex CLI를 쓰거나 플러그인을 두고 싶지 않으면 아래 세 단계로 붙이면 돼요. 둘 다
        같은 서버에 붙는 거라 결과는 같아요.
      </>
    ),
    stepsHeading: "연결하는 세 단계",
    stepsLead: (
      <>
        Cushion 서버는 URL과 <code>Authorization: Bearer</code> 헤더만 있으면 되는 Streamable HTTP
        서버라 <strong className="text-foreground">클라이언트를 가리지 않아요.</strong> ①에서 쓰는
        클라이언트를 고르세요. ③은 어떤 클라이언트를 쓰든 같아요.
      </>
    ),
    thirdHeading: "③이 가장 안 보이지만 가장 중요해요",
    third1: (
      <>
        로컬에 문서가 없는 것이 이 구조의 정상 상태라, 에이전트는 표시가 없으면 그냥 지나가요.{" "}
        <code>AGENTS.md</code>의 한 줄이{" "}
        <strong className="text-foreground">Cushion을 찾게 만드는 유일한 신호</strong>
        이고, <code>/cushion-use</code>가 그 줄을 대신 넣어 줘요.
      </>
    ),
    third2: (
      <>
        팀원이 이미 <code>AGENTS.md</code>를 커밋해 뒀다면 합류하는 사람은 ①만 마치면 돼요.
      </>
    ),
    teamHeading: "팀 전체에 배포할 때",
    team1: (
      <>
        개인 연결은 위 세 단계로 끝나요. 레포에 커밋해 팀 전원에게 배포하려면 라이브러리 설정에서{" "}
        <code>.mcp.json</code> 스니펫을 받으세요.{" "}
        <strong className="text-foreground">그 파일에는 토큰을 넣지 않아요.</strong> 커밋되는
        파일이라 환경변수 확장(<code>{"${CUSHION_TOKEN}"}</code>)을 써요.
      </>
    ),
    team2: (
      <>
        프로젝트 스코프 설정은 user 스코프를 덮어써요. 개인이 이미 연결해 둔 상태에서{" "}
        <code>.mcp.json</code>만 받으면 <code>CUSHION_TOKEN</code> 없이는 그 프로젝트 안에서만 401이
        나요.
      </>
    ),
    connect: {
      claudeShell: "셸에서 한 번 실행",
      antigravity: "~/.gemini/config/mcp_config.json 에 추가 (url이 아니라 serverUrl 키예요)",
      codexProfile: "먼저 셸 프로필(.zshrc 등)에 추가",
      codexConfig: "~/.codex/config.toml에 추가 (토큰을 직접 넣지 않고 환경변수 이름만 가리켜요)",
    },
  },

  en: {
    title: "Install",
    lead: <>One token is all you need. Step ① alone is enough for an agent to read and write.</>,
    tokenHeading: "Get a token first",
    tokenBody: (
      <>
        Issue one at{" "}
        <Link href="/settings/tokens" className="underline underline-offset-4">
          /settings/tokens
        </Link>{" "}
        and the snippets in ① below come back{" "}
        <strong className="text-foreground">with the token already filled in</strong>, one per
        client. The token is shown that once and never again — the server keeps only a sha256 hash,
        so if you lose it you issue a new one.
      </>
    ),
    pluginHeading: "On Claude Code it is two lines",
    pluginLead: (
      <>
        The plugin brings{" "}
        <strong className="text-foreground">the server config and the skills together</strong>.
        These two lines stand in for ① and ② of the three steps below, so only ③ is left.
      </>
    ),
    pluginCopyLabel: "Run these in order inside Claude Code",
    pluginToken: (
      <>
        It asks for the token during <code>install</code>. Paste it and it goes into Claude
        Code&apos;s secure storage, so it{" "}
        <strong className="text-foreground">never sits in a config file in plain text</strong> —
        which is what makes this safer than the command in ①.
      </>
    ),
    pluginPrefix: (
      <>
        Skills that arrive through a plugin are prefixed with the plugin name. In ③, use{" "}
        <code>/cushion:cushion-use</code> instead of <code>/cushion-use</code>. The rest follow the
        same shape, like <code>/cushion:cushion-new</code>.
      </>
    ),
    pluginAlt: (
      <>
        If you use Antigravity or Codex CLI, or would rather not install a plugin, the three steps
        below do the same job. Both routes connect to the same server.
      </>
    ),
    stepsHeading: "Connecting in three steps",
    stepsLead: (
      <>
        The Cushion server is a Streamable HTTP server that needs nothing but a URL and an{" "}
        <code>Authorization: Bearer</code> header, so it{" "}
        <strong className="text-foreground">works with any client</strong>. Pick yours in ①. Step ③
        is the same whichever client you use.
      </>
    ),
    thirdHeading: "③ is the least visible and the most important",
    third1: (
      <>
        Having no docs in the repo is the normal state here, so without a marker an agent simply
        walks past. That one line in <code>AGENTS.md</code> is{" "}
        <strong className="text-foreground">
          the only signal that makes an agent find Cushion
        </strong>
        , and <code>/cushion-use</code> writes it for you.
      </>
    ),
    third2: (
      <>
        If a teammate already committed <code>AGENTS.md</code>, anyone joining only has to do ①.
      </>
    ),
    teamHeading: "Rolling it out to a team",
    team1: (
      <>
        For yourself the three steps above are the whole story. To commit it to the repo and hand it
        to everyone, grab the <code>.mcp.json</code> snippet from the library settings.{" "}
        <strong className="text-foreground">That file never holds the token.</strong> It gets
        committed, so it uses environment variable expansion (<code>{"${CUSHION_TOKEN}"}</code>).
      </>
    ),
    team2: (
      <>
        Project-scope config overrides user scope. If you were already connected and then pick up
        only <code>.mcp.json</code>, you get a 401 inside that project — and only there — until{" "}
        <code>CUSHION_TOKEN</code> is set.
      </>
    ),
    connect: {
      claudeShell: "Run once in a shell",
      antigravity: "Add to ~/.gemini/config/mcp_config.json (the key is serverUrl, not url)",
      codexProfile: "First add it to your shell profile (.zshrc and friends)",
      codexConfig: "Add to ~/.codex/config.toml (it points at the variable name, never the token)",
    },
  },
};
