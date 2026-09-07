/**
 * @file app/docs/usage/page.tsx
 * @description 문서 — 사용법. 툴 레퍼런스는 `lib/mcp.ts`에서 생성한다(ToolTable).
 *
 * 에이전트가 매 세션 받는 지침(`INSTRUCTIONS`)도 여기서 그대로 보여준다. 사람이 읽는
 * 안내와 에이전트가 받는 지침이 다르면, 왜 그렇게 동작하는지 설명이 안 된다.
 *
 * ⚠️ 그 인용문과 툴 표는 **한국어 화면에서도 영어로 나온다.** 번역한 게 아니라 서버가
 *    실제로 보내는 문자열이기 때문이다(에이전트용 텍스트는 영어 한 벌이다). 여기서
 *    번역해 버리면 화면과 실물이 갈려서, 툴이 왜 그렇게 구는지 대조할 수단이 사라진다.
 */
import type { Metadata } from "next";

import { DocsPager } from "@/components/DocsPager";
import { DocsTransition } from "@/components/DocsTransition";
import { ToolTable } from "@/components/ToolTable";
import { getI18n, type Locale } from "@/lib/i18n";
import { INSTRUCTIONS } from "@/lib/mcp";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: COPY[locale].title };
}

interface UsageCopy {
  title: string;
  lead: React.ReactNode;
  instructionsHeading: string;
  instructionsLead: React.ReactNode;
  instructionsNote: React.ReactNode;
  readHeading: string;
  readSample: string;
  read1: React.ReactNode;
  read2: React.ReactNode;
  writeHeading: string;
  writeSample: string;
  write1: React.ReactNode;
  write2: React.ReactNode;
  staleHeading: React.ReactNode;
  stale1: React.ReactNode;
  stale2: React.ReactNode;
  historyHeading: string;
  history1: React.ReactNode;
  history2: React.ReactNode;
  backupHeading: string;
  backup: React.ReactNode;
  toolsHeading: string;
  authHeading: string;
  auth: React.ReactNode[];
}

export default async function DocsUsagePage() {
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
          <h2 className="text-lg font-medium">{c.instructionsHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.instructionsLead}</p>
          <blockquote className="rounded-lg border-l-2 bg-muted/30 p-4 text-sm leading-relaxed">
            {INSTRUCTIONS}
          </blockquote>
          <p className="text-xs text-muted-foreground">{c.instructionsNote}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.readHeading}</h2>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
            {c.readSample}
          </pre>
          <p className="text-sm text-muted-foreground">{c.read1}</p>
          <p className="text-sm text-muted-foreground">{c.read2}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.writeHeading}</h2>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
            {c.writeSample}
          </pre>
          <p className="text-sm text-muted-foreground">{c.write1}</p>
          <p className="text-sm text-muted-foreground">{c.write2}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.staleHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.stale1}</p>
          <p className="text-sm text-muted-foreground">{c.stale2}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.historyHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.history1}</p>
          <p className="text-sm text-muted-foreground">{c.history2}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.backupHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.backup}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.toolsHeading}</h2>
          <ToolTable />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.authHeading}</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {c.auth.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>

        <DocsPager current="/docs/usage" />
      </article>
    </DocsTransition>
  );
}

const COPY: Record<Locale, UsageCopy> = {
  ko: {
    title: "사용법",
    lead: (
      <>
        연결하고 나면 에이전트에게 <code>doc_*</code> 툴이 보여요. 직접 부를 일은 없지만, 에이전트가
        예상과 다르게 굴 때 원인을 찾으려면 동작을 알아야 해요.
      </>
    ),
    instructionsHeading: "에이전트가 매 세션 받는 지침",
    instructionsLead: (
      <>
        서버가 <code>initialize</code> 응답에 실어 보내는 문자열이에요. 이게 툴 사용 순서를 정해요.
        에이전트용 텍스트는 언어를 나누지 않아서 영어 한 벌이고, 아래 인용은 실제로 나가는 그
        문자열이에요.
      </>
    ),
    instructionsNote: (
      <>매 세션 컨텍스트에 들어가기 때문에 짧게 유지해요. 이 안내 자체도 토큰을 쓰거든요.</>
    ),
    readHeading: "읽기: 목차 먼저, 섹션만",
    readSample: `doc_outline                                   # 무슨 문서에 무슨 섹션이 있나
doc_get(library:"cushion", path:"SPEC.md",
        heading:"6. 인증 · 권한")              # 그 섹션만
doc_get(…, if_none_match:"<직전 sha>")        # 안 바뀌었으면 unchanged`,
    read1: (
      <>
        <strong className="text-foreground">문서를 통째로 읽지 않는 것이 요점이에요.</strong>{" "}
        <code>doc_outline</code>은 문서 목록과 <code>##</code> 헤딩만 줘요. 어느 문서에 있는지
        모르면 <code>doc_search</code>가 매칭된 섹션 상위 몇 개를 줘요.
      </>
    ),
    read2: (
      <>
        <code>if_none_match</code>에 직전 sha를 넣으면, 안 바뀐 문서는 본문 대신{" "}
        <code>unchanged</code>로 끝나요. 같은 문서를 두 번 싣지 않기 위한 장치예요.
      </>
    ),
    writeHeading: "쓰기: 병합하지 않아요",
    writeSample: `doc_put(library:"cushion", path:"SPEC.md",
        heading:"6. 인증 · 권한",      # 이 섹션만 교체
        content:"## 6. 인증 · 권한\\n…",
        base_sha:"<직전 doc_get의 sha>",
        note:"토큰 회전 규칙 추가")`,
    write1: (
      <>
        <code>base_sha</code>는 읽을 때 받은 sha예요. 그 사이 누가 고쳤으면{" "}
        <strong className="text-foreground">거부하고 현재 sha를 알려줘요.</strong> 자동으로 합치지
        않아요. 다시 읽고 다시 쓰면 돼요.
      </>
    ),
    write2: (
      <>
        <code>heading</code>을 주면 그 섹션만 교체해요. 문서 전체를 보내지 않아도 되니 쓰기 쪽
        토큰도 줄어요.
      </>
    ),
    staleHeading: (
      <>
        밀렸을 때: <code>[stale]</code>
      </>
    ),
    stale1: (
      <>
        폴링도 상시 연결도 없어요. 세션 중에 문서가 바뀌면 다음 툴 응답 끝에 <code>[stale]</code> 한
        줄이 붙어요. 그때 <code>doc_changes_since</code>를 부르면 커서 이후에 무엇이 바뀌었는지
        요약이 와요.
      </>
    ),
    stale2: (
      <>
        요약은 <strong className="text-foreground">경로와 섹션, 증감</strong>을 조합한 구조적
        형태예요. LLM을 쓰지 않아요. 요약 모델은 본문만 봐서 “어느 코드가 영향받는지”가 추측이
        되거든요.
      </>
    ),
    historyHeading: "이력과 되돌리기",
    history1: (
      <>
        본문을 덮어쓰기 전에 이전 것을 반드시 남겨요.{" "}
        <strong className="text-foreground">삭제할 때도 남겨요.</strong>
      </>
    ),
    history2: (
      <>
        문서 화면의 <strong className="text-foreground">이력</strong>에서 버전 사이 변경을 hunk로
        보고, 과거 본문을 전문으로 열고, 되돌릴 수 있어요. 되돌리기는 덮어쓰기가 아니라 새 저장이라
        “언제 무엇으로 되돌렸는지”가 남아요.
      </>
    ),
    backupHeading: "백업",
    backup: (
      <>
        <code>/api/export</code>가 유일한 백업이에요. 관리 화면에서 전체를 내려받을 수 있어요.
        원본이 여기 있다는 건 여기가 사라지면 문서도 사라진다는 뜻이에요.
      </>
    ),
    toolsHeading: "툴 레퍼런스",
    authHeading: "권한",
    auth: [
      <>
        토큰에 권한을 저장하지 않아요. 라이브러리 권한은{" "}
        <strong className="text-foreground">요청 시점에 멤버 목록을 조회</strong>
        해서 판정하므로, 멤버에서 빼면 재발급 없이 즉시 차단돼요
      </>,
      <>
        권한 없는 라이브러리는 403이 아니라 <strong className="text-foreground">404</strong>예요.
        403은 “그 라이브러리가 존재한다”를 알려주기 때문이에요
      </>,
      <>
        토큰 하나로 <strong className="text-foreground">읽기와 쓰기를 모두</strong> 해요. 유출되면
        문서 훼손까지 가능하고, 복구 근거는 이력뿐이에요
      </>,
    ],
  },

  en: {
    title: "Usage",
    lead: (
      <>
        Once connected, your agent sees the <code>doc_*</code> tools. You will not call them by
        hand, but when an agent behaves unexpectedly you need to know how they work to find out why.
      </>
    ),
    instructionsHeading: "What the agent is told every session",
    instructionsLead: (
      <>
        This is the string the server ships in its <code>initialize</code> response. It is what sets
        the order the tools get used in.
      </>
    ),
    instructionsNote: (
      <>
        It goes into the context every session, so it stays short — this guidance costs tokens too.
      </>
    ),
    readHeading: "Reading: outline first, then one section",
    readSample: `doc_outline                                   # which documents, which sections
doc_get(library:"cushion", path:"SPEC.md",
        heading:"6. Auth")                    # just that section
doc_get(…, if_none_match:"<previous sha>")    # unchanged if nothing moved`,
    read1: (
      <>
        <strong className="text-foreground">The point is never to read a whole document.</strong>{" "}
        <code>doc_outline</code> gives you the list of documents and their <code>##</code> headings.
        If you do not know which document holds it, <code>doc_search</code> returns the top matching
        sections.
      </>
    ),
    read2: (
      <>
        Pass the previous sha in <code>if_none_match</code> and an unchanged document comes back as{" "}
        <code>unchanged</code> instead of a body. That is the piece that stops you loading the same
        document twice.
      </>
    ),
    writeHeading: "Writing: nothing is merged",
    writeSample: `doc_put(library:"cushion", path:"SPEC.md",
        heading:"6. Auth",            # replace only this section
        content:"## 6. Auth\\n…",
        base_sha:"<sha from the last doc_get>",
        note:"add the token rotation rule")`,
    write1: (
      <>
        <code>base_sha</code> is the sha you got when reading. If someone edited in the meantime the
        write is{" "}
        <strong className="text-foreground">rejected and the current sha comes back</strong>.
        Nothing is merged for you — read again, write again.
      </>
    ),
    write2: (
      <>
        Give a <code>heading</code> and only that section is replaced. You never send the whole
        document, so the write side costs fewer tokens too.
      </>
    ),
    staleHeading: (
      <>
        When you are behind: <code>[stale]</code>
      </>
    ),
    stale1: (
      <>
        No polling, no standing connection. If a document changes mid-session, one{" "}
        <code>[stale]</code> line is appended to the next tool response. Call{" "}
        <code>doc_changes_since</code> then and you get a summary of everything after your cursor.
      </>
    ),
    stale2: (
      <>
        The summary is structural —{" "}
        <strong className="text-foreground">path, sections and the line delta</strong>. No LLM is
        involved: a summarizing model only sees the prose, which turns &ldquo;which code does this
        affect&rdquo; into a guess.
      </>
    ),
    historyHeading: "History and restoring",
    history1: (
      <>
        The previous body is always kept before anything is overwritten —{" "}
        <strong className="text-foreground">deletions included</strong>.
      </>
    ),
    history2: (
      <>
        From <strong className="text-foreground">History</strong> on a document you can read the
        change between two versions as hunks, open an old body in full, and restore it. Restoring is
        a new save rather than an overwrite, so &ldquo;when, and back to what&rdquo; stays on the
        record.
      </>
    ),
    backupHeading: "Backup",
    backup: (
      <>
        <code>/api/export</code> is the only backup. You can download everything from the admin
        screen. The source of truth living here means that if this goes away, so do the docs.
      </>
    ),
    toolsHeading: "Tool reference",
    authHeading: "Permissions",
    auth: [
      <>
        Permissions are never baked into a token. Library access is decided by{" "}
        <strong className="text-foreground">looking up the member list at request time</strong>, so
        removing someone cuts them off immediately, with no token rotation
      </>,
      <>
        A library you cannot access returns <strong className="text-foreground">404</strong>, not
        403 — a 403 would tell you that library exists
      </>,
      <>
        One token does <strong className="text-foreground">both reading and writing</strong>. A leak
        means documents can be damaged, and the history is the only thing you can recover from
      </>,
    ],
  },
};
