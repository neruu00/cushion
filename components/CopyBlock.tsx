"use client";

/**
 * @file components/CopyBlock.tsx
 * @description 붙여넣기용 코드 블록 + 복사 버튼. 클라이언트 JS가 필요한 최소 리프.
 */
import { Check, Copy, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";

interface CopyBlockProps {
  value: string;
  label?: string;
  /**
   * 값을 감추고 복사 버튼만 남긴다. 초대 링크처럼 **줄바꿈 지점이 없는 긴 한 줄**을
   * 좁은 다이얼로그에 넣을 때 쓴다 — 그런 값은 `overflow-x-auto`를 줘도 상자를 넓혀
   * 다이얼로그를 뚫고 나간다. 어차피 사람이 읽을 값이 아니라 복사해서 보낼 값이다.
   */
  hideValue?: boolean;
}

export function CopyBlock({ value, label, hideValue = false }: CopyBlockProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  /**
   * 복사가 실패하면 감춰 둔 값을 드러낸다 — 손으로 복사할 길이 그것뿐이다.
   * 한 번 드러나면 되돌리지 않는다: 2초 뒤 다시 감추면 그 사이에 복사를 못 한다.
   */
  const [revealed, setRevealed] = useState(false);
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
      // flushSync로 <pre>를 먼저 DOM에 올린다 — 감춰진 상태에서는 선택할 노드가 없다.
      flushSync(() => setRevealed(true));
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

  const showValue = !hideValue || revealed;

  return (
    // min-w-0: 부모가 flex·grid일 때(다이얼로그 안이 그렇다) 기본값 min-width:auto가
    // 안의 내용 크기를 그대로 밀어붙여서, overflow-x-auto가 있어도 이 블록 자체가
    // 넓어져 버린다. min-w-0을 안 주면 내부 스크롤이 아니라 다이얼로그가 넓어진다.
    <div className="min-w-0 rounded-lg border bg-muted/40">
      <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-1.5">
        {/* 긴 안내문이 와도(예: 초대 링크 힌트) 잘리지 않고 줄바꿈된다 */}
        <span className="min-w-0 font-mono text-xs text-muted-foreground">{label ?? ""}</span>
        <Button type="button" variant="ghost" size="xs" className="shrink-0" onClick={copy}>
          {state === "copied" ? <Check /> : state === "failed" ? <TriangleAlert /> : <Copy />}
          {state === "copied" ? "복사됨" : state === "failed" ? "선택했어요 — Ctrl+C" : "복사"}
        </Button>
      </div>
      {showValue && (
        <pre
          ref={preRef}
          className="min-w-0 overflow-x-auto border-t px-3 py-2 font-mono text-xs leading-relaxed"
        >
          {value}
        </pre>
      )}
    </div>
  );
}
