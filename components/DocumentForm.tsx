"use client";

/**
 * @file components/DocumentForm.tsx
 * @description 문서 편집 폼. 원본이 Cushion에 있으므로 여기가 저장 지점이다 (D-011).
 *
 * 두 가지가 이 컴포넌트의 존재 이유다:
 *
 * 1. **`base_sha`를 들고 다닌다.** 저장에 성공하면 서버가 준 새 sha로, 충돌하면 서버가 알려준
 *    현재 sha로 갈아끼운다. 갈아끼우지 않으면 재시도가 영원히 같은 sha로 실패한다.
 * 2. **textarea가 제어 컴포넌트다.** React 19는 form action이 끝나면 uncontrolled 입력을
 *    초기화한다 — 그대로 두면 저장할 때마다 쓰던 글이 사라진다. 충돌했을 때 특히 치명적이다.
 */
import { CircleAlert } from "lucide-react";
import { useActionState, useState } from "react";

import { saveDocument } from "@/actions/document";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUiCopy } from "@/components/UiCopyProvider";
import type { Dict } from "@/lib/i18n.en";

interface DocumentFormProps {
  library: string;
  /** 새 문서면 빈 문자열 */
  path: string;
  content: string;
  /** 새 문서면 빈 문자열 */
  sha: string;
  /** 서버 페이지가 고른 언어 조각. 버튼 같은 공용 문구는 컨텍스트에서 온다 */
  t: Dict["doc"];
}

export function DocumentForm({ library, path, content, sha, t }: DocumentFormProps) {
  const { common } = useUiCopy();
  const [state, formAction, pending] = useActionState(saveDocument, null);
  const [draft, setDraft] = useState(content);

  const currentSha = state?.success ? (state.data?.sha ?? sha) : (state?.conflict?.sha ?? sha);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="library" value={library} />
      <input type="hidden" name="base_sha" value={currentSha} />

      {path ? (
        <input type="hidden" name="path" value={path} />
      ) : (
        <Label className="grid gap-1.5">
          <span className="text-sm">{t.path}</span>
          <Input name="path" placeholder=".specs/api.md" required />
        </Label>
      )}

      <Label className="grid gap-1.5">
        <span className="text-sm">{t.content}</span>
        <textarea
          name="content"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          required
          spellCheck={false}
          rows={28}
          className="w-full rounded-lg border bg-transparent p-3 font-mono text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Label>

      <Label className="grid gap-1.5">
        <span className="text-sm">{t.note}</span>
        <Input name="note" placeholder={t.notePlaceholder} />
      </Label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? common.saving : common.save}
        </Button>
        {state?.success ? (
          <span className="text-sm text-muted-foreground">{common.saved}</span>
        ) : null}
      </div>

      {state?.success === false ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>{state.error}</AlertTitle>
          {state.conflict ? (
            <AlertDescription className="space-y-2">
              {/* 병합하지 않는다. 사람이 두 본문을 보고 정한다 — 그게 유일하게 안전한 방법이다.
                  base_sha는 이미 갱신됐으므로 지금 그대로 저장하면 내 내용이 이긴다. */}
              <p>{t.conflictBody}</p>
              <details className="rounded-lg border bg-background/50">
                <summary className="cursor-pointer px-3 py-1.5 text-sm">
                  {t.conflictShowServer}
                </summary>
                <pre className="max-h-80 overflow-auto px-3 pb-3 font-mono text-xs leading-relaxed">
                  {state.conflict.content}
                </pre>
              </details>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDraft(state.conflict?.content ?? draft)}
              >
                {t.conflictTakeServer}
              </Button>
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}
    </form>
  );
}
