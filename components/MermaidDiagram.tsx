"use client";

/**
 * @file components/MermaidDiagram.tsx
 * @description 문서 안 ```mermaid 코드 블록을 SVG로 그린다.
 *
 * `mermaid` 패키지는 모듈 최상단에서 import하지 않는다 — `useEffect` 안에서 동적
 * import해야 번들러가 이 무거운 라이브러리를 별도 청크로 쪼갠다. 이 컴포넌트 자체(가벼운
 * 래퍼)는 `Markdown.tsx`를 쓰는 모든 문서 화면에 실리지만, mermaid 코드는 실제로 그
 * 블록이 있는 문서를 열 때만 내려온다 — 없는 문서는 여전히 그 비용을 안 낸다.
 *
 * 서버 컴포넌트인 `Markdown.tsx`가 이 클라이언트 리프를 그대로 import해서 쓴다 —
 * 서버 컴포넌트가 클라이언트 컴포넌트를 자식으로 두는 건 표준 패턴이라 문제 없다.
 */
import { useEffect, useId, useRef, useState } from "react";

interface MermaidDiagramProps {
  code: string;
}

type RenderState =
  | { status: "loading" }
  | { status: "done" }
  | { status: "error"; message: string };

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RenderState>({ status: "loading" });
  // useId는 렌더마다 안정적이고 SSR과도 어긋나지 않는다 — mermaid는 id별로 내부 캐시를 쓴다.
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;

    import("mermaid").then(async ({ default: mermaid }) => {
      if (cancelled) return;
      try {
        // 앱에 다크모드 토글이 없다(SPEC §9) — OS 설정을 그대로 따른다.
        const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        mermaid.initialize({ startOnLoad: false, theme: prefersDark ? "dark" : "default" });

        const { svg } = await mermaid.render(`mermaid-${id}`, code);
        if (cancelled) return;
        if (containerRef.current) containerRef.current.innerHTML = svg;
        setState({ status: "done" });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "다이어그램을 그리지 못했어요",
          });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (state.status === "error") {
    // 문법이 틀려도 페이지 전체를 죽이지 않는다 — 원본 코드를 그대로 보여준다.
    return (
      <div className="not-prose space-y-2 rounded-lg border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          다이어그램을 그리지 못했어요: {state.message}
        </p>
        <pre className="overflow-x-auto text-xs">{code}</pre>
      </div>
    );
  }

  return (
    // not-prose: prose의 이미지·코드 스타일이 SVG 안까지 침범하지 않게 한다.
    // 그려지기 전엔 빈 상자만 있다 — 다이어그램은 대개 작은 문서 안 몇 개뿐이라
    // 스켈레톤까지는 과하다.
    <div ref={containerRef} className="not-prose overflow-x-auto [&_svg]:mx-auto" />
  );
}
