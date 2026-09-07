/**
 * @file app/docs/page.tsx
 * @description 문서 — 개요. "무엇을 왜"만 담는다. 붙이는 방법은 설치 페이지가 맡는다.
 *
 * 문장은 두 언어로 아래 `COPY`에 있다. 골격(섹션 순서·다이어그램 자리·목록 구조)은
 * 하나뿐이라 한쪽 언어에만 섹션이 생기는 일이 없다 — 늘어나는 건 문장뿐이다.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { ArchitectureDiagram } from "@/components/DocsDiagrams";
import { DocsPager } from "@/components/DocsPager";
import { DocsTransition } from "@/components/DocsTransition";
import { getI18n, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: COPY[locale].title };
}

interface Trait {
  term: string;
  detail: React.ReactNode;
}

interface OverviewCopy {
  title: string;
  lead: React.ReactNode;
  goal: React.ReactNode;
  whyHeading: string;
  why1: React.ReactNode;
  why2: React.ReactNode;
  measured: React.ReactNode;
  measuredNote: React.ReactNode;
  howHeading: string;
  how1: React.ReactNode;
  how2: React.ReactNode;
  how3: React.ReactNode;
  traitsHeading: string;
  traits: Trait[];
  outHeading: string;
  outLead: React.ReactNode;
  out: React.ReactNode[];
}

export default async function DocsOverviewPage() {
  const { locale } = await getI18n();
  const c = COPY[locale];

  return (
    <DocsTransition>
      <article className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="text-muted-foreground">{c.lead}</p>
          <p className="text-muted-foreground">{c.goal}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.whyHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.why1}</p>
          <p className="text-sm text-muted-foreground">{c.why2}</p>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            {c.measured}
            <p className="mt-1 text-xs text-muted-foreground">{c.measuredNote}</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.howHeading}</h2>
          <div className="rounded-lg border bg-muted/20 p-4">
            <ArchitectureDiagram />
          </div>
          <p className="text-sm text-muted-foreground">{c.how1}</p>
          <p className="text-sm text-muted-foreground">{c.how2}</p>
          <p className="text-sm text-muted-foreground">{c.how3}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.traitsHeading}</h2>
          <dl className="space-y-4 text-sm">
            {c.traits.map((trait) => (
              <div key={trait.term}>
                <dt className="font-medium">{trait.term}</dt>
                <dd className="text-muted-foreground">{trait.detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">{c.outHeading}</h2>
          <p className="text-sm text-muted-foreground">{c.outLead}</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {c.out.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>

        <DocsPager current="/docs" />
      </article>
    </DocsTransition>
  );
}

const COPY: Record<Locale, OverviewCopy> = {
  ko: {
    title: "개요",
    lead: (
      <>
        Cushion은{" "}
        <strong className="text-foreground">에이전트를 1차 독자로 삼은 문서 도서관</strong>
        이에요. 스펙·ADR·런북·회의록·용어집을 한곳에 두면, 팀에는 변경 알림이 가고 에이전트는 MCP로{" "}
        <strong className="text-foreground">필요한 조각만</strong> 읽고 써요.
      </>
    ),
    goal: <>에이전트가 같은 문서를 세션마다 다시 싣느라 소모하는 토큰을 줄이는 것이 목적이에요.</>,
    whyHeading: "왜 필요한가",
    why1: (
      <>
        에이전트에게 스펙을 읽히는 흔한 방법은 파일 전체를 컨텍스트에 넣는 것이에요. 그런데 한 번의
        작업에 필요한 부분은 대개 섹션 하나고, 다음 세션에는 같은 문서를 처음부터 다시 싣게 돼요.
        문서가 자랄수록 이 비용은 작업 수에 비례해 늘어나요.
      </>
    ),
    why2: (
      <>
        Cushion은 이 과정을 <strong className="text-foreground">목차 한 번 + 섹션 하나씩</strong>
        으로 바꿔요. 목차는 세션당 한 번이라 작업이 늘어날수록 격차가 벌어져요.
      </>
    ),
    measured: (
      <>
        <strong>Cushion 자신의 문서로 측정한 값</strong>이에요. 문서 전체를 불러올 때와 비교하면{" "}
        <strong>20% 미만으로 줄어들고, 5배 이상 절감</strong>돼요.
      </>
    ),
    measuredNote: (
      <>
        측정 대상이 이 프로젝트의 문서라 값도 함께 움직여요. <code>pnpm acceptance</code>가 그때그때
        다시 재요.
      </>
    ),
    howHeading: "어떻게 동작하나",
    how1: (
      <>
        <strong className="text-foreground">문서의 원본이 여기에 있어요.</strong> 웹 편집
        화면에서도, 에이전트의 <code>doc_put</code>으로도 같은 문서를 고쳐요. 어느 쪽이든 이력과
        변경 요약이 남아요.
      </>
    ),
    how2: (
      <>
        <strong className="text-foreground">같은 요약 하나</strong>가 팀 채널 알림과 에이전트의{" "}
        <code>[stale]</code> 델타에 모두 쓰여요.
      </>
    ),
    how3: (
      <>
        덮어쓰기 전에 이전 본문을 남기는 <strong className="text-foreground">이력</strong>, 읽을 때
        받은 sha를 쓸 때 되돌려 받아 어긋나면 거부하는{" "}
        <strong className="text-foreground">동시 편집 보호</strong>, 그리고 유일한 백업인{" "}
        <strong className="text-foreground">내보내기</strong>가 있어요.{" "}
        <Link href="/docs/usage" className="underline underline-offset-4">
          사용법
        </Link>
        에서 자세히 다뤄요.
      </>
    ),
    traitsHeading: "세 가지 성질",
    traits: [
      {
        term: "한곳에",
        detail: <>모든 변경이 이력에 남고 되돌릴 수 있어요. 삭제한 기록도 남아요.</>,
      },
      {
        term: "조각만",
        detail: (
          <>
            목차를 먼저 보고 필요한 <code>##</code> 섹션만 가져가요. 바뀌지 않은 문서를 다시 물으면
            본문 대신 <code>unchanged</code> 한 단어로 끝나요.
          </>
        ),
      },
      {
        term: "밀렸을 때만",
        detail: (
          <>
            폴링도 상시 연결도 없어요. 문서가 바뀌면 다음 툴 응답 끝에 <code>[stale]</code> 한 줄이
            붙고, 팀 채널에는 무엇이 왜 바뀌었는지가 알림으로 전달돼요.
          </>
        ),
      },
    ],
    outHeading: "들여오지 않는 것",
    outLead: <>빠뜨린 것이 아니라 기각한 것들이에요. 이유는 결정 로그에 있어요.</>,
    out: [
      <>
        <strong className="text-foreground">LLM 변경 요약</strong>: 요약 모델은 본문만 보기 때문에
        “어느 코드가 영향받는지”가 추측이 돼요. 그래서 경로와 섹션, 증감을 조합한 구조적 요약을 써요
      </>,
      <>
        <strong className="text-foreground">자동 병합과 충돌 해결 UI</strong>: 브랜치가 없어서
        병합할 근거가 없어요. <code>base_sha</code>가 어긋나면 거부하기만 해요
      </>,
      <>
        <strong className="text-foreground">임베딩과 벡터 DB</strong>: 스펙 수십 개 규모에서는 부분
        문자열 스코어링만으로도 충분해요
      </>,
      <>
        <strong className="text-foreground">폴링과 상시 연결 구독</strong>: 커서와 응답에 붙이는{" "}
        <code>[stale]</code> 한 줄로 대신해요
      </>,
    ],
  },

  en: {
    title: "Overview",
    lead: (
      <>
        Cushion is a{" "}
        <strong className="text-foreground">
          documentation library whose first reader is an agent
        </strong>
        . Keep your specs, ADRs, runbooks, meeting notes and glossaries in one place: your team gets
        a notification when something changes, and an agent reads and writes{" "}
        <strong className="text-foreground">only the piece it needs</strong> over MCP.
      </>
    ),
    goal: <>The point is to stop burning tokens re-loading the same document in every session.</>,
    whyHeading: "Why it exists",
    why1: (
      <>
        The usual way to let an agent read a spec is to drop the whole file into its context. But a
        single task usually needs one section, and the next session loads that same document from
        scratch again. The bigger the document, the more this cost scales with the number of tasks.
      </>
    ),
    why2: (
      <>
        Cushion turns that into{" "}
        <strong className="text-foreground">one outline, then one section at a time</strong>. The
        outline is fetched once per session, so the gap widens as tasks pile up.
      </>
    ),
    measured: (
      <>
        <strong>Measured against Cushion&apos;s own docs.</strong> Compared with loading every
        document in full, that is <strong>under 20% of the tokens — more than a 5× saving</strong>.
      </>
    ),
    measuredNote: (
      <>
        The thing being measured is this project&apos;s own documentation, so the number moves as
        the docs grow. <code>pnpm acceptance</code> re-measures it each time.
      </>
    ),
    howHeading: "How it works",
    how1: (
      <>
        <strong className="text-foreground">The source of truth lives here.</strong> The web editor
        and an agent&apos;s <code>doc_put</code> edit the same document, and either way you get a
        version in the history and a change summary.
      </>
    ),
    how2: (
      <>
        <strong className="text-foreground">One and the same summary</strong> feeds both the team
        channel notification and the agent&apos;s <code>[stale]</code> delta.
      </>
    ),
    how3: (
      <>
        There is <strong className="text-foreground">history</strong>, which keeps the previous body
        before anything is overwritten;{" "}
        <strong className="text-foreground">concurrent-edit protection</strong>, which hands you a
        sha when you read and rejects the write if it no longer matches; and{" "}
        <strong className="text-foreground">export</strong>, which is the only backup.{" "}
        <Link href="/docs/usage" className="underline underline-offset-4">
          Usage
        </Link>{" "}
        covers all three.
      </>
    ),
    traitsHeading: "Three properties",
    traits: [
      {
        term: "In one place",
        detail: <>Every change lands in the history and can be restored — deletions included.</>,
      },
      {
        term: "A piece at a time",
        detail: (
          <>
            Read the outline first, then pull only the <code>##</code> section you need. Ask again
            for a document that has not changed and you get the single word <code>unchanged</code>{" "}
            instead of the body.
          </>
        ),
      },
      {
        term: "Only when you are behind",
        detail: (
          <>
            No polling, no standing connection. When a document changes, one <code>[stale]</code>{" "}
            line is appended to the next tool response, and the team channel gets a notification
            saying what changed and why.
          </>
        ),
      },
    ],
    outHeading: "What it deliberately leaves out",
    outLead: <>These were rejected, not forgotten. The reasoning is in the decision log.</>,
    out: [
      <>
        <strong className="text-foreground">LLM-written change summaries</strong>: a summarizing
        model only sees the prose, so &ldquo;which code does this affect&rdquo; becomes a guess.
        Instead we build a structural summary out of the path, the sections and the line delta
      </>,
      <>
        <strong className="text-foreground">Auto-merge and a conflict-resolution UI</strong>: there
        are no branches, so there is nothing to merge against. A mismatched <code>base_sha</code> is
        simply rejected
      </>,
      <>
        <strong className="text-foreground">Embeddings and a vector database</strong>: at a scale of
        a few dozen specs, substring scoring is enough
      </>,
      <>
        <strong className="text-foreground">Polling and always-on subscriptions</strong>: replaced
        by a cursor and one <code>[stale]</code> line on the response
      </>,
    ],
  },
};
