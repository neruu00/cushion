"use client";

/**
 * @file components/MembersDialog.tsx
 * @description 멤버 목록·초대·제거. 라이브러리 화면의 한 섹션이던 것을 다이얼로그로 옮겼다.
 *
 * 멤버는 자주 보는 정보가 아니다 — 화면 아래를 계속 차지하느니 헤더의 버튼 뒤에 두는 편이
 * 낫다. 대신 인원수를 버튼에 적어 열어보지 않아도 규모는 알 수 있게 한다.
 *
 * **제출해도 닫지 않는다.** 초대·제거 결과를 그 자리에서 확인해야 하고, 자동으로 닫으면
 * 실패 메시지를 못 읽고 지나간다 (SPEC §9의 다이얼로그 규칙과 같은 이유).
 *
 * 권한 문턱은 이 화면을 여는 것과 같다 — 멤버면 멤버를 관리할 수 있다 (D-013).
 * 실제 판정은 서버 액션이 다시 한다. 여기 버튼이 보이는 것과 통과하는 것은 별개다.
 */
import { Trash2, Users } from "lucide-react";

import { addMember, removeMember } from "@/actions/library";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MembersDialogProps {
  libraryId: string;
  members: { email: string }[];
  /** 지금 보고 있는 사람. 자기 행에 "(나)"를 붙여 나가기임을 알린다 */
  currentEmail: string;
}

export function MembersDialog({ libraryId, members, currentEmail }: MembersDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Users /> 멤버 {members.length}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>멤버</DialogTitle>
          <DialogDescription>
            멤버는 이 라이브러리의 문서를 읽고 쓸 수 있고, 다른 멤버를 초대할 수 있어요.
            자기 자신을 지우면 나가는 거예요 — 마지막 멤버가 나가면 아무도 볼 수 없게 돼요.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y rounded-lg border">
          {members.map((member) => (
            <li key={member.email} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="truncate font-mono text-sm">
                {member.email}
                {member.email === currentEmail ? " (나)" : ""}
              </span>
              {/* 자기 자신 제거는 나가기다 — 되돌리려면 남은 멤버가 다시 불러야 하고,
                  마지막 멤버면 아무도 못 부른다. 확인을 세운다 */}
              <ConfirmDialog
                trigger={<Trash2 />}
                triggerVariant="destructive"
                aria-label={`${member.email} 제거`}
                title={member.email === currentEmail ? "이 라이브러리에서 나갈까요?" : "멤버를 제거할까요?"}
                confirmLabel={member.email === currentEmail ? "나가기" : "제거"}
                destructive
                description={
                  <>
                    <span className="block font-mono text-xs">{member.email}</span>
                    <span className="mt-2 block">
                      {member.email === currentEmail
                        ? members.length === 1
                          ? "마지막 멤버예요. 나가면 아무도 이 라이브러리를 볼 수 없게 돼요."
                          : "나가면 이 라이브러리의 문서를 더는 볼 수 없어요. 남은 멤버가 다시 초대할 수 있어요."
                        : "문서를 더는 읽고 쓸 수 없게 돼요. 다시 초대할 수 있어요."}
                    </span>
                  </>
                }
                formId={`remove-${member.email}`}
              >
                <form id={`remove-${member.email}`} action={removeMember}>
                  <input type="hidden" name="library_id" value={libraryId} />
                  <input type="hidden" name="email" value={member.email} />
                </form>
              </ConfirmDialog>
            </li>
          ))}
        </ul>

        <ActionForm action={addMember} submitLabel="초대">
          <input type="hidden" name="library_id" value={libraryId} />
          <Label className="grid gap-1.5">
            <span>이메일</span>
            <Input name="email" type="email" placeholder="teammate@example.com" required />
          </Label>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
