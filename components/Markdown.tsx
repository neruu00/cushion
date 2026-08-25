/**
 * @file components/Markdown.tsx
 * @description 마크다운 렌더. **서버 컴포넌트다** — 클라이언트 번들 0이 기본이다 (SPEC §9).
 *
 * 읽기 전용 화면에 에디터 런타임을 싣지 않는다. `'use client'`를 붙이는 순간
 * react-markdown 전체가 브라우저로 내려간다.
 *
 * ponytail: 코드 하이라이팅(rehype-highlight)은 넣지 않았다. 스펙은 대부분 산문이고
 * highlight.js + 테마 CSS를 값어치보다 먼저 들이게 된다. 필요해지면 플러그인 한 줄이다.
 *
 * **예외가 하나 있다 — ```mermaid 블록.** `pre`를 가로채 그 경우에만 클라이언트 리프
 * `MermaidDiagram`으로 넘긴다. 이 파일 자체는 여전히 서버 컴포넌트고, mermaid 라이브러리는
 * 그 리프 안 `useEffect`에서 동적 import된다 — mermaid 블록이 없는 문서는 여전히
 * 그 비용을 안 낸다. 서버 컴포넌트가 클라이언트 리프를 자식으로 두는 표준 패턴이다.
 */
import { isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MermaidDiagram } from "@/components/MermaidDiagram";

interface MarkdownProps {
  children: string;
}

/** 펜스 블록은 react-markdown이 `<pre><code className="language-x">…</code></pre>`로 준다. */
function mermaidCodeOf(preChildren: React.ReactNode): string | null {
  if (!isValidElement(preChildren)) return null;
  const props = preChildren.props as { className?: unknown; children?: unknown };
  if (typeof props.className !== "string" || !props.className.includes("language-mermaid")) {
    return null;
  }
  // 코드 블록 끝의 개행 하나는 마크다운 파서가 항상 붙인다 — 다이어그램 문법과 무관하다.
  return String(props.children ?? "").replace(/\n$/, "");
}

export function Markdown({ children }: MarkdownProps) {
  return (
    // prose 기본값은 영어 산문 기준(16px · 행간 1.75 · 리스트 여백 0.5em)이라 한국어에는
    // 성글다 — 글자가 조밀해 같은 값이면 훨씬 벌어져 보인다. prose-sm(14px)을 바닥으로
    // 깔고 문단·리스트 행간만 1.7로 살짝 되올린다(한글은 라틴보다 행간이 조금 더 필요하다).
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:leading-[1.7] prose-li:leading-[1.7] prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-pre:overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children: preChildren, ...rest }) {
            const mermaidCode = mermaidCodeOf(preChildren);
            if (mermaidCode !== null) return <MermaidDiagram code={mermaidCode} />;
            return <pre {...rest}>{preChildren}</pre>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
