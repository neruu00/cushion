/**
 * @file components/DocsDiagrams.tsx
 * @description /docs 페이지의 설명 다이어그램 3종. 전부 서버 렌더 SVG다.
 *
 * mermaid를 쓰지 않는다 — mermaid의 값은 "임의의 다이어그램 텍스트를 그때그때 렌더"인데,
 * 여기 그림은 몇 장으로 고정이고 코드와 같이 커밋된다. 클라이언트 렌더는 보기 화면
 * 번들 0 원칙(SPEC §9)에 어긋나고, 빌드 타임 렌더(mermaid-cli)는 Puppeteer가 딸려온다.
 * 고정된 그림 몇 장에는 손 SVG가 가장 싸다 — 라이브러리를 얹을 이유가 없다.
 *
 * 색은 shadcn 토큰만 쓴다. 데이터가 아니라 설명이라 강조는 amber(주의 한 줄)와
 * destructive(거부) 딱 두 곳이다.
 *
 * 라벨은 파일 아래 `DIAGRAMS`에 두 언어로 있다. 좌표와 화살표(골격)는 한 벌뿐이라
 * 한쪽 언어에만 상자가 생기는 일이 없다 — 늘어나는 건 문자열뿐이다.
 *
 * `aria-label`도 같이 번역한다. 그림을 못 보는 사람에게는 그게 그림 자체다.
 */
import { getI18n, type Locale } from "@/lib/i18n";

interface NodeProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  /** 제목이 툴 이름이면 mono */
  mono?: boolean;
  /** danger = 거부 상자 (충돌 다이어그램) */
  tone?: "default" | "danger";
}

/** 라운드 상자 + 제목 + 부제. 세 다이어그램이 같은 상자 문법을 쓰게 한다. */
function Node({ x, y, w, h, title, sub, mono = false, tone = "default" }: NodeProps) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className={
          tone === "danger"
            ? "fill-background stroke-destructive/70"
            : "fill-background stroke-border"
        }
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={cx}
        y={sub ? cy - 3 : cy + 4}
        textAnchor="middle"
        className={`fill-foreground text-[11px] font-medium ${mono ? "font-mono" : ""}`}
      >
        {title}
      </text>
      {sub && (
        <text x={cx} y={cy + 13} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {sub}
        </text>
      )}
    </g>
  );
}

interface ArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  marker: string;
  /** 양끝 화살표 (읽기·쓰기 양방향) */
  both?: boolean;
  label?: string;
  labelX?: number;
  labelY?: number;
}

function Arrow({ x1, y1, x2, y2, marker, both = false, label, labelX, labelY }: ArrowProps) {
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        className="stroke-muted-foreground/70"
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
        markerEnd={`url(#${marker})`}
        markerStart={both ? `url(#${marker})` : undefined}
      />
      {label && (
        <text
          x={labelX ?? (x1 + x2) / 2}
          y={labelY ?? (y1 + y2) / 2 - 6}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function ArrowDefs({ id }: { id: string }) {
  return (
    <defs>
      {/* orient=auto-start-reverse: marker-start에 달면 반대 방향을 본다 — 양방향 화살표용 */}
      <marker
        id={id}
        viewBox="0 0 8 8"
        refX="7"
        refY="4"
        markerWidth="6.5"
        markerHeight="6.5"
        orient="auto-start-reverse"
      >
        <path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground/70" />
      </marker>
    </defs>
  );
}

/**
 * 개요 — 전체 구조. 쓰기는 두 입구(웹·MCP)가 한곳으로 모이고,
 * 변경 요약 하나가 두 소비자(팀 알림·에이전트 델타)에게 나간다.
 */
export async function ArchitectureDiagram() {
  const { locale } = await getI18n();
  const d = DIAGRAMS[locale].architecture;

  return (
    <svg viewBox="0 0 720 280" className="w-full" role="img" aria-label={d.alt}>
      <ArrowDefs id="arch-arrow" />

      {/* 왼쪽 — 쓰는 쪽 둘 */}
      <Node x={30} y={56} w={150} h={52} title={d.human} sub={d.humanSub} />
      <Node x={30} y={176} w={150} h={52} title={d.agent} sub="doc_get · doc_put" />

      {/* 가운데 — Cushion. 원본과 그 뒷정리 */}
      <rect
        x={272}
        y={28}
        width={196}
        height={224}
        rx={10}
        className="fill-muted/30 stroke-border"
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={370}
        y={50}
        textAnchor="middle"
        className="fill-foreground text-[11px] font-semibold"
      >
        Cushion
      </text>
      <Node x={288} y={62} w={164} h={42} title="documents" sub={d.source} mono />
      <Node x={288} y={122} w={164} h={42} title="document_versions" sub={d.versions} mono />
      <Node x={288} y={182} w={164} h={42} title="sync_events" sub={d.events} mono />
      <Arrow x1={370} y1={104} x2={370} y2={121} marker="arch-arrow" />
      <Arrow x1={370} y1={164} x2={370} y2={181} marker="arch-arrow" />

      {/* 오른쪽 — 같은 요약의 두 소비자 */}
      <Node x={540} y={62} w={150} h={52} title={d.channel} sub="Mattermost · Discord" />
      <Node x={540} y={182} w={150} h={52} title={d.nextCall} sub={d.nextCallSub} />

      <Arrow x1={180} y1={82} x2={270} y2={82} marker="arch-arrow" label={d.edit} />
      <Arrow x1={180} y1={202} x2={270} y2={202} marker="arch-arrow" both label={d.mcp} />
      <Arrow
        x1={452}
        y1={193}
        x2={538}
        y2={98}
        marker="arch-arrow"
        label={d.notify}
        labelX={504}
        labelY={136}
      />
      <Arrow
        x1={452}
        y1={210}
        x2={538}
        y2={210}
        marker="arch-arrow"
        label={d.staleLine}
        labelX={495}
      />
    </svg>
  );
}

/**
 * 사용법 · 쓰기 — base_sha 충돌은 병합하지 않고 거부한다.
 * 거부 응답에 현재 sha가 실려 에이전트가 사람 없이 스스로 회복하는 흐름.
 */
export async function ConflictDiagram() {
  const { locale } = await getI18n();
  const d = DIAGRAMS[locale].conflict;

  return (
    <svg viewBox="0 0 720 150" className="w-full" role="img" aria-label={d.alt}>
      <ArrowDefs id="cas-arrow" />

      <Node x={24} y={36} w={150} h={76} title="① doc_get" sub={d.step1} mono />
      <Node x={204} y={36} w={150} h={76} title={d.step2} sub={d.step2Sub} />
      <Node
        x={384}
        y={36}
        w={150}
        h={76}
        title="③ put(base_sha:a1)"
        sub={d.step3}
        mono
        tone="danger"
      />
      <Node x={564} y={36} w={132} h={76} title={d.step4} sub={d.step4Sub} />

      <Arrow x1={174} y1={74} x2={202} y2={74} marker="cas-arrow" />
      <Arrow x1={354} y1={74} x2={382} y2={74} marker="cas-arrow" />
      <Arrow x1={534} y1={74} x2={562} y2={74} marker="cas-arrow" />
    </svg>
  );
}

/**
 * 사용법 · 구독 — 폴링 없이 최신을 아는 경로.
 * 밀렸을 때만 응답 끝에 한 줄이 붙고, 안 밀렸으면 아무것도 없다(비용 0).
 */
export async function StaleDiagram() {
  const { locale } = await getI18n();
  const d = DIAGRAMS[locale].stale;

  return (
    <svg viewBox="0 0 720 168" className="w-full" role="img" aria-label={d.alt}>
      <ArrowDefs id="stale-arrow" />

      <Node x={24} y={32} w={200} h={88} title={d.someoneEdited} sub={d.someoneEditedSub} />

      {/* 가운데 상자는 응답 카드 모양 — 마지막 한 줄이 핵심이라 직접 그린다 */}
      <g>
        <rect
          x={260}
          y={32}
          width={200}
          height={88}
          rx={8}
          className="fill-background stroke-border"
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={360}
          y={54}
          textAnchor="middle"
          className="fill-foreground text-[11px] font-medium"
        >
          {d.response}
        </text>
        <text
          x={360}
          y={74}
          textAnchor="middle"
          className="fill-muted-foreground font-mono text-[10px]"
        >
          {d.body}
        </text>
        <text x={360} y={92} textAnchor="middle" className="fill-amber-600 font-mono text-[10px]">
          [stale] cushion: SPEC.md
        </text>
        <text x={360} y={134} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {d.onlyWhenBehind}
        </text>
      </g>

      <Node x={496} y={32} w={200} h={88} title="doc_changes_since" sub={d.delta} mono />

      <Arrow x1={224} y1={76} x2={258} y2={76} marker="stale-arrow" />
      <Arrow x1={460} y1={76} x2={494} y2={76} marker="stale-arrow" />
    </svg>
  );
}

/**
 * 그림의 문자열만 언어별로. 좌표·화살표는 위 골격 한 벌이 쓴다.
 * `documents`·`sync_events` 같은 테이블 이름은 번역하지 않는다 — 실제 이름이다.
 */
const DIAGRAMS: Record<
  Locale,
  {
    architecture: Record<
      | "alt"
      | "human"
      | "humanSub"
      | "agent"
      | "source"
      | "versions"
      | "events"
      | "channel"
      | "nextCall"
      | "nextCallSub"
      | "edit"
      | "mcp"
      | "notify"
      | "staleLine",
      string
    >;
    conflict: Record<
      "alt" | "step1" | "step2" | "step2Sub" | "step3" | "step4" | "step4Sub",
      string
    >;
    stale: Record<
      | "alt"
      | "someoneEdited"
      | "someoneEditedSub"
      | "response"
      | "body"
      | "onlyWhenBehind"
      | "delta",
      string
    >;
  }
> = {
  ko: {
    architecture: {
      alt: "Cushion의 구조를 나타낸 그림이에요. 사람이 웹에서 편집한 내용과 에이전트가 MCP로 호출한 내용이 모두 documents 원본으로 모여요. 변경된 내용은 이력과 변경 요약으로 남고, 그 요약 하나가 팀 채널 알림과 에이전트의 stale 델타에 똑같이 쓰여요.",
      human: "사람",
      humanSub: "웹 편집 화면",
      agent: "에이전트",
      source: "원본",
      versions: "이력 · append-only",
      events: "변경 요약",
      channel: "팀 채널",
      nextCall: "에이전트 (다음 호출)",
      nextCallSub: "[stale] → 델타",
      edit: "편집",
      mcp: "MCP 읽기·쓰기",
      notify: "알림",
      staleLine: "[stale] 한 줄",
    },
    conflict: {
      alt: "충돌이 일어나는 과정을 나타낸 그림이에요. doc_get으로 sha a1을 받은 뒤 그 사이에 다른 사람이 저장해서 sha가 b2로 바뀌면, base_sha가 a1인 doc_put은 거부되고 서버가 현재 sha를 회신해요. 그다음에는 새 sha 위에 변경을 다시 얹어서 저장해요.",
      step1: "sha:a1을 받음",
      step2: "② 남이 먼저 저장",
      step2Sub: "현재는 sha:b2",
      step3: "거부 + 현재 sha 회신",
      step4: "④ b2 위에 다시",
      step4Sub: "저장 (병합 없음)",
    },
    stale: {
      alt: "stale 표시가 붙는 과정을 나타낸 그림이에요. 누군가 문서를 고치면 변경 요약이 쌓이고, 에이전트가 받는 다음 툴 응답 끝에 stale 한 줄이 붙어요. 그때 doc_changes_since를 부르면 경로와 섹션, 증감 요약이 오고 커서가 전진해요.",
      someoneEdited: "누가 문서를 고침",
      someoneEditedSub: "sync_events에 요약이 쌓임",
      response: "다음 툴 호출의 응답",
      body: "…본문 그대로…",
      onlyWhenBehind: "밀렸을 때만 붙고, 아니면 없어요",
      delta: "경로+섹션+증감 · 커서 전진",
    },
  },

  en: {
    architecture: {
      alt: "A diagram of how Cushion is put together. Edits made by a person in the web editor and calls made by an agent over MCP both land in the same documents source of truth. Every change leaves a version in the history and a change summary, and that one summary is what goes to the team channel and to the agent's stale delta.",
      human: "Person",
      humanSub: "Web editor",
      agent: "Agent",
      source: "source of truth",
      versions: "history · append-only",
      events: "change summary",
      channel: "Team channel",
      nextCall: "Agent (next call)",
      nextCallSub: "[stale] → delta",
      edit: "edit",
      mcp: "MCP read/write",
      notify: "notify",
      staleLine: "one [stale] line",
    },
    conflict: {
      alt: "A diagram of how a conflict happens. After doc_get hands you sha a1, someone else saves and the sha becomes b2; a doc_put carrying base_sha a1 is rejected and the server returns the current sha. You then reapply your change on top of the new sha and save again.",
      step1: "receives sha:a1",
      step2: "② someone saves first",
      step2Sub: "now sha:b2",
      step3: "rejected + current sha returned",
      step4: "④ reapply on b2",
      step4Sub: "save (no merge)",
    },
    stale: {
      alt: "A diagram of how the stale marker appears. When someone edits a document, a change summary piles up, and one stale line is appended to the end of the next tool response the agent receives. Calling doc_changes_since then returns a path, section and line-delta summary and advances the cursor.",
      someoneEdited: "Someone edits a doc",
      someoneEditedSub: "summary piles up in sync_events",
      response: "the next tool response",
      body: "…body as usual…",
      onlyWhenBehind: "only when you are behind, otherwise absent",
      delta: "path + section + delta · cursor moves",
    },
  },
};
