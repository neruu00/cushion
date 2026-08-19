/**
 * @file app/docs/page.tsx
 * @description 문서 — 개요. "무엇을 왜"만 담는다. 붙이는 방법은 설치 페이지가 맡는다.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { ArchitectureDiagram } from "@/components/DocsDiagrams";
import { DocsPager } from "@/components/DocsPager";
import { DocsTransition } from "@/components/DocsTransition";

export const metadata: Metadata = { title: "개요" };

export default function DocsOverviewPage() {
  return (
    <DocsTransition>
      <article className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">개요</h1>
          <p className="text-muted-foreground">
            Cushion은 <strong className="text-foreground">에이전트를 1차 독자로 삼은 문서 도서관</strong>
            이에요. 스펙·ADR·런북·회의록·용어집을 한곳에 두면, 팀에는 변경 알림이 가고
            에이전트는 MCP로 <strong className="text-foreground">필요한 조각만</strong> 읽고 써요.
          </p>
          <p className="text-muted-foreground">
            목적은 하나예요 — 에이전트가 같은 문서를 세션마다 컨텍스트에 싣느라 태우는 토큰을 줄이는 것.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">왜 필요한가</h2>
          <p className="text-sm text-muted-foreground">
            에이전트에게 스펙을 읽히는 가장 흔한 방법은 파일 전체를 컨텍스트에 넣는 거예요. 그런데
            한 번의 작업에 실제로 필요한 건 대개 섹션 하나고, 다음 세션에는 같은 문서를 처음부터
            다시 싣게 돼요. 문서가 자랄수록 이 비용은 작업 수에 비례해 늘어나요.
          </p>
          <p className="text-sm text-muted-foreground">
            Cushion은 그 흐름을 <strong className="text-foreground">목차 한 번 + 섹션 하나씩</strong>
            으로 바꿔요. 목차는 세션당 한 번이라 작업이 늘수록 격차가 벌어져요.
          </p>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <strong>자기 자신의 문서로 잰 값</strong> — 전량 로드 대비 <strong>20% 미만, 5배 이상 절감</strong>.
            <p className="mt-1 text-xs text-muted-foreground">
              측정 대상이 이 프로젝트의 문서라 문서가 자라면 값도 움직여요. 그래서 숫자를 박아 두지
              않고 <code>pnpm acceptance</code>가 그때그때 다시 재요.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">어떻게 동작하나</h2>
          <div className="rounded-lg border bg-muted/20 p-4">
            <ArchitectureDiagram />
          </div>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">문서의 원본이 여기 있어요.</strong> 웹 편집 화면에서도,
            에이전트의 <code>doc_put</code>으로도 같은 문서를 만들고 고쳐요 — 어느 입구로 쓰든 같은
            경로를 지나 이력과 변경 요약이 남아요.
          </p>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">같은 요약 하나</strong>가 팀 채널 알림과 에이전트의{" "}
            <code>[stale]</code> 델타에 두 번 쓰여요 — 두 기능이 아니라 한 문자열이에요.
          </p>
          <p className="text-sm text-muted-foreground">
            덮어쓰기 전에 이전 본문을 남기는 <strong className="text-foreground">이력</strong>, 읽을
            때 받은 sha를 쓸 때 되돌려 받아 어긋나면 거부하는{" "}
            <strong className="text-foreground">동시 편집 보호</strong>, 그리고 유일한 백업인{" "}
            <strong className="text-foreground">내보내기</strong>가 있어요.{" "}
            <Link href="/docs/usage" className="underline underline-offset-4">
              사용법
            </Link>
            에서 자세히 다뤄요.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">세 가지 성질</h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-medium">한곳에</dt>
              <dd className="text-muted-foreground">
                웹 편집 화면에서도, 에이전트의 <code>doc_put</code>으로도 같은 문서를 만들고 고쳐요.
                모든 변경이 이력에 남고 되돌릴 수 있어요. 삭제도 남아요.
              </dd>
            </div>
            <div>
              <dt className="font-medium">조각만</dt>
              <dd className="text-muted-foreground">
                목차를 먼저 보고 필요한 <code>##</code> 섹션만 가져가요. 안 바뀐 문서를 다시 물으면
                본문 대신 <code>unchanged</code> 다섯 글자로 끝나요.
              </dd>
            </div>
            <div>
              <dt className="font-medium">밀렸을 때만</dt>
              <dd className="text-muted-foreground">
                폴링도 상시 연결도 없어요. 문서가 바뀌면 다음 툴 응답 끝에 <code>[stale]</code> 한 줄이
                붙고, 팀 채널에는 무엇이 왜 바뀌었는지가 가요.
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">들여오지 않는 것</h2>
          <p className="text-sm text-muted-foreground">
            빠뜨린 게 아니라 기각한 것들이에요. 각각 결정 로그에 이유가 있어요.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">LLM 변경 요약</strong> — 요약 모델은 본문만 보므로
              “어느 코드가 영향받는지”가 추측이 돼요. 경로 + 섹션 + 증감의 구조적 요약으로 가요
            </li>
            <li>
              <strong className="text-foreground">자동 병합·충돌 해결 UI</strong> — 브랜치가 없어
              병합할 근거가 없어요. <code>base_sha</code>로 거부만 해요
            </li>
            <li>
              <strong className="text-foreground">임베딩·벡터 DB</strong> — 스펙 수십 개 규모에서는
              부분 문자열 스코어링으로 충분해요
            </li>
            <li>
              <strong className="text-foreground">폴링·상시 연결 구독</strong> — 커서와 응답에 얹는{" "}
              <code>[stale]</code> 한 줄로 대체해요
            </li>
          </ul>
        </section>

        <DocsPager current="/docs" />
      </article>
    </DocsTransition>
  );
}
