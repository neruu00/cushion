/**
 * @file components/Markdown.tsx
 * @description 마크다운 렌더. **서버 컴포넌트다** — 클라이언트 번들 0 (SPEC §9).
 *
 * 읽기 전용 화면에 에디터 런타임을 싣지 않는다. `'use client'`를 붙이는 순간
 * react-markdown 전체가 브라우저로 내려간다.
 *
 * ponytail: 코드 하이라이팅(rehype-highlight)은 넣지 않았다. 스펙은 대부분 산문이고
 * highlight.js + 테마 CSS를 값어치보다 먼저 들이게 된다. 필요해지면 플러그인 한 줄이다.
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownProps {
  children: string;
}

export function Markdown({ children }: MarkdownProps) {
  return (
    // prose 기본값은 영어 산문 기준(16px · 행간 1.75 · 리스트 여백 0.5em)이라 한국어에는
    // 성글다 — 글자가 조밀해 같은 값이면 훨씬 벌어져 보인다. prose-sm(14px)을 바닥으로
    // 깔고 문단·리스트 행간만 1.7로 살짝 되올린다(한글은 라틴보다 행간이 조금 더 필요하다).
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:leading-[1.7] prose-li:leading-[1.7] prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2 prose-pre:overflow-x-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
