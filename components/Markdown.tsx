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
    <div className="prose prose-neutral dark:prose-invert max-w-none prose-pre:overflow-x-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
