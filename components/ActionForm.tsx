"use client";

/**
 * @file components/ActionForm.tsx
 * @description 서버 액션 폼 + 결과 표시. 발급된 비밀값이 있으면 그 자리에서 1회 노출한다.
 *
 * 평범한 `<form action={...}>`으로는 반환값을 못 보는데, 토큰 평문은 이 응답이 유일한
 * 노출 기회다(서버는 해시만 갖는다). 그래서 이 셋(레포 생성·sync 재발급·PAT 발급)만
 * 클라이언트 컴포넌트로 둔다.
 */
import { CircleAlert } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyBlock } from "@/components/CopyBlock";
import type { SecretState } from "@/lib/action.type";

interface ActionFormProps {
  action: (prev: SecretState, formData: FormData) => Promise<SecretState>;
  submitLabel: string;
  children?: React.ReactNode;
  className?: string;
}

export function ActionForm({ action, submitLabel, children, className }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className="space-y-3">
      <form action={formAction} className={className ?? "flex flex-wrap items-end gap-2"}>
        {children}
        <Button type="submit" disabled={pending}>
          {pending ? "처리 중…" : submitLabel}
        </Button>
      </form>

      {state?.success === false && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state?.success && state.data && (
        <div className="space-y-3">
          <Alert>
            <AlertTitle>지금 한 번만 보인다</AlertTitle>
            <AlertDescription>
              서버는 해시만 저장한다. 이 화면을 벗어나면 다시 볼 수 없고, 재발급만 가능하다.
            </AlertDescription>
          </Alert>
          <CopyBlock value={state.data.secret} label={state.data.hint} />
          {state.data.files?.map((file) => (
            <CopyBlock key={file.name} value={file.content} label={file.name} />
          ))}
        </div>
      )}
    </div>
  );
}
