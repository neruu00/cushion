/**
 * @file app/docs/usage/page.tsx
 * @description 문서 — 사용법. 툴 레퍼런스는 `lib/mcp.ts`에서 생성한다(ToolTable).
 *
 * 에이전트가 매 세션 받는 지침(`INSTRUCTIONS`)도 여기서 그대로 보여준다. 사람이 읽는
 * 안내와 에이전트가 받는 지침이 다르면, 왜 그렇게 동작하는지 설명이 안 된다.
 */
import type { Metadata } from "next";

import { DocsPager } from "@/components/DocsPager";
import { DocsTransition } from "@/components/DocsTransition";
import { ToolTable } from "@/components/ToolTable";
import { INSTRUCTIONS } from "@/lib/mcp";

export const metadata: Metadata = { title: "사용법" };

export default function DocsUsagePage() {
  return (
    <DocsTransition>
      <article className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">사용법</h1>
          <p className="text-muted-foreground">
            연결하고 나면 에이전트에게 <code>doc_*</code> 툴이 보여요. 사람이 이 툴을 직접 부를 일은
            없지만, <strong className="text-foreground">무엇이 왜 그렇게 도는지</strong> 알아야
            에이전트가 이상하게 굴 때 원인을 짚을 수 있어요.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">에이전트가 매 세션 받는 지침</h2>
          <p className="text-sm text-muted-foreground">
            서버가 <code>initialize</code> 응답에 실어 보내는 문자열이에요. 이게 툴 사용 순서를 정해요.
          </p>
          <blockquote className="rounded-lg border-l-2 bg-muted/30 p-4 text-sm leading-relaxed">
            {INSTRUCTIONS}
          </blockquote>
          <p className="text-xs text-muted-foreground">
            매 세션 컨텍스트에 들어가서 짧게 유지해요 — 이 안내 자체가 토큰이거든요.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">읽기 — 목차 먼저, 섹션만</h2>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
{`doc_outline                                   # 무슨 문서에 무슨 섹션이 있나
doc_get(library:"cushion", path:"SPEC.md",
        heading:"6. 인증 · 권한")              # 그 섹션만
doc_get(…, if_none_match:"<직전 sha>")        # 안 바뀌었으면 unchanged`}
          </pre>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">문서를 통째로 읽지 않는 게 요점이에요.</strong>{" "}
            <code>doc_outline</code>은 문서 목록과 <code>##</code> 헤딩만 줘요. 어느 문서에 있는지
            모르면 <code>doc_search</code>가 매칭 섹션 상위 몇 개를 줘요.
          </p>
          <p className="text-sm text-muted-foreground">
            <code>if_none_match</code>에 직전 sha를 넣으면, 안 바뀐 문서는 본문 대신{" "}
            <code>unchanged</code>로 끝나요. 같은 문서를 두 번 싣지 않기 위한 장치예요.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">쓰기 — 병합하지 않아요</h2>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
{`doc_put(library:"cushion", path:"SPEC.md",
        heading:"6. 인증 · 권한",      # 이 섹션만 교체
        content:"## 6. 인증 · 권한\\n…",
        base_sha:"<직전 doc_get의 sha>",
        note:"토큰 회전 규칙 추가")`}
          </pre>
          <p className="text-sm text-muted-foreground">
            <code>base_sha</code>는 읽을 때 받은 sha예요. 그 사이 누가 고쳤으면{" "}
            <strong className="text-foreground">거부하고 현재 sha를 알려줘요.</strong> 자동으로
            합치지 않아요 — 브랜치가 없으니 합칠 근거가 없거든요. 다시 읽고 다시 쓰는 게 맞아요.
          </p>
          <p className="text-sm text-muted-foreground">
            <code>heading</code>을 주면 그 섹션만 갈아끼워요. 문서 전체를 되돌려 보내지 않아도 되니
            쓰기 쪽 토큰도 줄어요.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">밀렸을 때 — <code>[stale]</code></h2>
          <p className="text-sm text-muted-foreground">
            폴링도 상시 연결도 없어요. 세션 중에 문서가 바뀌면 다음 툴 응답 끝에{" "}
            <code>[stale]</code> 한 줄이 붙어요. 그때 <code>doc_changes_since</code>를 부르면
            커서 이후에 무엇이 바뀌었는지 요약이 와요.
          </p>
          <p className="text-sm text-muted-foreground">
            요약은 <strong className="text-foreground">경로 + 섹션 + 증감</strong>의 구조적 형태예요.
            LLM이 쓴 요약이 아니에요 — 요약 모델은 본문만 봐서 “어느 코드가 영향받는지”가
            추측이 되기 때문이에요.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">이력과 되돌리기</h2>
          <p className="text-sm text-muted-foreground">
            원본이 여기 있고 되돌릴 git이 없어서, 본문을 덮기 전에 이전 것을 반드시 남겨요.{" "}
            <strong className="text-foreground">삭제할 때도 남겨요</strong> — 삭제야말로 되돌릴 수
            있어야 하니까요.
          </p>
          <p className="text-sm text-muted-foreground">
            문서 화면의 <strong className="text-foreground">이력</strong> 탭에서 버전 사이 변경을
            hunk로 보고, 과거 본문을 전문으로 열고, 되돌릴 수 있어요. 되돌리기는 덮어쓰기가 아니라
            새 저장이에요 — 그래야 “언제 무엇으로 되돌렸나”가 남아요.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">백업</h2>
          <p className="text-sm text-muted-foreground">
            <code>/api/export</code>가 유일한 탈출구예요. 관리 화면에서 전체를 내려받을 수 있어요.
            원본이 여기 있다는 건, 여기가 사라지면 끝이라는 뜻이기도 해요.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">툴 레퍼런스</h2>
          <ToolTable />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">권한</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              토큰에 권한을 굽지 않아요. 토큰은 이메일까지만 해석하고, 라이브러리 권한은{" "}
              <strong className="text-foreground">요청 시점에 멤버 목록을 조회</strong>해요 —
              멤버에서 빼면 토큰 재발급 없이 즉시 차단돼요
            </li>
            <li>
              권한 없는 라이브러리는 403이 아니라 <strong className="text-foreground">404</strong>예요.
              403은 “그 라이브러리가 존재한다”를 알려주기 때문이에요
            </li>
            <li>
              토큰 하나로 <strong className="text-foreground">읽기와 쓰기를 모두</strong> 해요.
              유출되면 열람만이 아니라 문서 훼손까지 가능하다는 뜻이에요 — 복구 근거는 이력뿐이에요
            </li>
          </ul>
        </section>

        <DocsPager current="/docs/usage" />
      </article>
    </DocsTransition>
  );
}
