"use client";

/**
 * @file components/CopyBlock.tsx
 * @description 붙여넣기용 코드 블록 + 복사 버튼. 클라이언트 JS가 필요한 최소 리프.
 */
import { Check, Copy, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

interface CopyBlockProps {
  value: string;
  label?: string;
}

export function CopyBlock({ value, label }: CopyBlockProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const preRef = useRef<HTMLPreElement>(null);

  async function copy() {
    try {
      // clipboard API는 https·localhost 밖에서는 아예 undefined다 — 조용히 죽으면
      // "복사했는데 안 붙는다"가 된다. 실패하면 본문을 통째로 선택해 준다:
      // Ctrl+C 한 번이면 되고, 뭘 해야 하는지 화면이 말해 준다.
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      const range = document.createRange();
      if (preRef.current) {
        range.selectNodeContents(preRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    // min-w-0: 부모가 flex·grid일 때(다이얼로그 안이 그렇다) 기본값 min-width:auto가
    // 안의 <pre>·label 내용 크기를 그대로 밀어붙여서, overflow-x-auto가 있어도 이 블록
    // 자체가 넓어져 버린다. min-w-0을 안 주면 내부 스크롤이 아니라 다이얼로그가 넓어진다.
    <div className="min-w-0 rounded-lg border bg-muted/40">
      <div className="flex min-w-0 items-center justify-between gap-2 border-b px-3 py-1.5">
        {/* 긴 안내문이 와도(예: 초대 링크 힌트) 잘리지 않고 줄바꿈된다 — truncate였다면
            한 줄로 잘려 못 읽혔다. 실제로 넓어지는 원인은 아래 <pre>의 값이다 */}
        <span className="min-w-0 font-mono text-xs text-muted-foreground">{label ?? ""}</span>
        <Button type="button" variant="ghost" size="xs" className="shrink-0" onClick={copy}>
          {state === "copied" ? <Check /> : state === "failed" ? <TriangleAlert /> : <Copy />}
          {state === "copied" ? "복사됨" : state === "failed" ? "선택했어요 — Ctrl+C" : "복사"}
        </Button>
      </div>
      <pre
        ref={preRef}
        className="min-w-0 overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed"
      >
        {value}
      </pre>
    </div>
  );
}
