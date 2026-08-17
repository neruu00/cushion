"use client";

/**
 * @file components/ConfirmDialog.tsx
 * @description 되돌릴 수 없거나 되돌리기 번거로운 동작 앞에 세우는 확인 창.
 *
 * 이게 생기기 전에는 되돌리기·삭제·멤버 제거가 **버튼 한 번에 즉시 실행**됐다.
 * 손이 미끄러지면 그대로 나간다.
 *
 * `window.confirm`을 쓰지 않는 이유: 무엇을 되돌리는지(어느 시각, 누가 쓴 것)를 보여줄 수
 * 없다. 확인 창의 값은 "정말?"이 아니라 **대상을 다시 보여주는 것**이다.
 *
 * **결과가 파괴적이지 않으면 그렇다고 적는다.** 되돌리기는 append-only라 이력이 남는데,
 * 그 사실을 모르면 사람이 필요한 동작을 겁내서 안 한다.
 *
 * **인터페이스가 render prop이 아닌 이유**: 이 컴포넌트는 클라이언트고 호출부는 대개 서버
 * 컴포넌트다. 함수는 그 경계를 넘지 못한다(`Functions are not valid as a child of Client
 * Components`). 그래서 호출부가 **폼 전체**를 `children`으로 넘기고, 확인 버튼은 여기서
 * 직접 렌더한다 — 서버 액션과 hidden 필드는 직렬화되므로 넘어간다.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  /** 트리거 버튼에 쓸 라벨 */
  trigger: React.ReactNode;
  title: string;
  /** 무엇에 대한 동작인지. 대상을 다시 보여주는 자리다 */
  description: React.ReactNode;
  /** 확인 버튼 라벨. 동사로 — "확인"은 무엇을 하는지 안 알려준다 */
  confirmLabel: string;
  /** 되돌릴 수 없는 동작이면 빨갛게 */
  destructive?: boolean;
  triggerVariant?: "outline" | "destructive" | "ghost";
  triggerSize?: "xs" | "sm" | "default";
  "aria-label"?: string;
  /**
   * `<form action={서버액션}>` + hidden 필드. **확인 버튼은 여기 넣지 않는다** —
   * 이 컴포넌트가 폼 안에 직접 넣는다(`form` 속성으로 이어 붙인다).
   */
  children: React.ReactNode;
  /** 폼 id. 확인 버튼을 그 폼에 이어 붙이는 데 쓴다 — 호출부마다 달라야 한다 */
  formId: string;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  triggerVariant = "outline",
  triggerSize = "xs",
  children,
  formId,
  ...rest
}: ConfirmDialogProps) {
  // 제출하면 서버 액션이 revalidate로 화면을 새로 그리는데, 다이얼로그가 열린 채면
  // 사라진 대상을 가리키고 있게 된다. 눌렀을 때 바로 닫는다.
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={triggerVariant} size={triggerSize} />}
        aria-label={rest["aria-label"]}
      >
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* 폼은 화면에 자리를 차지하지 않는다 — 안에 hidden 필드뿐이고, 제출 버튼은
            아래 footer에 있다가 `form` 속성으로 이 폼에 이어진다 */}
        {children}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
          <Button
            type="submit"
            form={formId}
            variant={destructive ? "destructive" : "default"}
            onClick={() => setOpen(false)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
