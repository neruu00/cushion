"use client";

/**
 * @file components/DocumentForm.tsx
 * @description 문서 편집 폼. 원본이 Cushion에 있으므로 여기가 저장 지점이다 (D-011).
 *
 * `base_sha`를 숨겨서 들고 다니는 게 이 컴포넌트의 핵심이다. 저장에 성공하면 서버가 돌려준
 * 새 sha로 갈아끼운다 — 안 그러면 연속 저장의 두 번째가 자기 자신과 충돌한다.
 */
import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { saveDocument } from "@/actions/document";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DocumentFormProps {
  repo: string;
  /** 새 문서면 빈 문자열 */
  path: string;
  content: string;
  /** 새 문서면 빈 문자열 */
  sha: string;
}

export function DocumentForm({ repo, path, content, sha }: DocumentFormProps) {
  const [state, formAction, pending] = useActionState(saveDocument, null);
  const currentSha = state?.success ? (state.data?.sha ?? sha) : sha;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="repo" value={repo} />
      <input type="hidden" name="base_sha" value={currentSha} />

      {path ? (
        <input type="hidden" name="path" value={path} />
      ) : (
        <Label className="grid gap-1.5">
          <span className="text-sm">경로</span>
          <Input name="path" placeholder=".specs/api.md" required />
        </Label>
      )}

      <Label className="grid gap-1.5">
        <span className="text-sm">내용</span>
        <textarea
          name="content"
          defaultValue={content}
          required
          spellCheck={false}
          rows={28}
          className="w-full rounded-lg border bg-transparent p-3 font-mono text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Label>

      <Label className="grid gap-1.5">
        <span className="text-sm">무엇을 왜 바꿨나</span>
        <Input name="note" placeholder="세션 만료 정책 변경" />
      </Label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : "저장"}
        </Button>
        {state?.success ? (
          <span className="text-sm text-muted-foreground">저장됨</span>
        ) : null}
      </div>

      {state?.success === false ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
