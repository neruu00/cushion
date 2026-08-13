"use client";

/**
 * @file components/CopyBlock.tsx
 * @description 붙여넣기용 코드 블록 + 복사 버튼. 클라이언트 JS가 필요한 최소 리프.
 */
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface CopyBlockProps {
  value: string;
  label?: string;
}

export function CopyBlock({ value, label }: CopyBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-1.5">
        <span className="truncate font-mono text-xs text-muted-foreground">{label ?? ""}</span>
        <Button type="button" variant="ghost" size="xs" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "복사됨" : "복사"}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed">{value}</pre>
    </div>
  );
}
