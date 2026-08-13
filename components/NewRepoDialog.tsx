"use client";

/**
 * @file components/NewRepoDialog.tsx
 * @description "새 레포" 버튼 → 다이얼로그 안에서 생성.
 *
 * 생성 직후 붙여넣을 설정 파일이 결과로 나오므로, 제출해도 닫지 않는다 —
 * 자동으로 닫으면 그 1회성 안내를 못 읽고 지나간다. 닫기는 사람이 한다.
 */
import { Plus } from "lucide-react";

import { createRepository } from "@/actions/repository";
import { ActionForm } from "@/components/ActionForm";
import { Field } from "@/components/Field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewRepoDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Plus /> 새 레포
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>새 레포</DialogTitle>
          <DialogDescription>
            slug는 소문자·숫자·하이픈. 만든 사람이 첫 멤버가 되고, 팀원은 레포 화면에서
            초대한다. 나머지는 나중에 채워도 된다.
          </DialogDescription>
        </DialogHeader>

        <ActionForm action={createRepository} submitLabel="만들기" className="grid gap-3">
          <Field name="slug" label="slug" placeholder="my-project" required />
          <Field name="name" label="이름" placeholder="My Project" required />
          <Field
            name="github_full_name"
            label="관련 GitHub (org/repo, 선택)"
            placeholder="org/repo"
          />
          <Field
            name="mattermost_webhook_url"
            label="Mattermost webhook (선택)"
            placeholder="https://…/hooks/…"
          />
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
