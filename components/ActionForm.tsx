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
import { ConnectTabs, type ConnectGroup } from "@/components/ConnectTabs";
import { CopyBlock } from "@/components/CopyBlock";
import type { SecretState } from "@/lib/action.type";

interface ActionFormProps {
  action: (prev: SecretState, formData: FormData) => Promise<SecretState>;
  submitLabel: string;
  children?: React.ReactNode;
  className?: string;
  /**
   * "tabs" = files를 group별로 묶어 탭으로 보여준다. 항목이 **이 중 하나만 고르면 되는**
   * 관계일 때다(연결 스니펫 — 쓰는 클라이언트 하나만 고른다).
   * 기본 "list"는 그냥 나열한다. 여러 파일을 **순서대로 다 쓰는** 관계일 때다
   * (`setupFiles()`의 `.mcp.json` + `AGENTS.md`).
   */
  filesLayout?: "list" | "tabs";
}

/** 순서를 유지하며 group으로 묶는다. group이 없으면 파일명 자체를 그룹으로 쓴다. */
function groupFiles(files: { name: string; content: string; group?: string }[]): ConnectGroup[] {
  const groups: ConnectGroup[] = [];
  for (const file of files) {
    const key = file.group ?? file.name;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: key, items: [] };
      groups.push(group);
    }
    group.items.push({ label: file.name, content: file.content });
  }
  return groups;
}

export function ActionForm({
  action,
  submitLabel,
  children,
  className,
  filesLayout = "list",
}: ActionFormProps) {
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
          {/* 보여줄 비밀값이 없는 액션도 있다 — 그때 "한 번만 보인다"는 거짓말이 된다 */}
          {state.data.secret ? (
            <>
              <Alert>
                <AlertTitle>지금 한 번만 보여요</AlertTitle>
                <AlertDescription>
                  서버에는 해시만 저장돼요. 이 화면을 벗어나면 다시 볼 수 없고, 재발급만 할 수 있어요.
                </AlertDescription>
              </Alert>
              <CopyBlock value={state.data.secret} label={state.data.hint} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{state.data.hint}</p>
          )}
          {state.data.files && filesLayout === "tabs" ? (
            <ConnectTabs groups={groupFiles(state.data.files)} />
          ) : (
            state.data.files?.map((file) => (
              <CopyBlock key={file.name} value={file.content} label={file.name} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
