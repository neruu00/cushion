"use client";

/**
 * @file components/NewLibraryDialog.tsx
 * @description "새 레포" 버튼 → 다이얼로그 안에서 생성.
 *
 * 생성 직후 붙여넣을 설정 파일이 결과로 나오므로, 제출해도 닫지 않는다 —
 * 자동으로 닫으면 그 1회성 안내를 못 읽고 지나간다. 닫기는 사람이 한다.
 */
import { Plus } from "lucide-react";

import { createLibrary } from "@/actions/library";
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

export function NewLibraryDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Plus /> 새 라이브러리
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>새 라이브러리</DialogTitle>
          <DialogDescription>
            slug는 소문자·숫자·하이픈만 쓸 수 있어요. 만든 사람이 첫 멤버가 되고, 팀원은
            라이브러리 화면에서 초대해요. 웹훅은 나중에 채워도 돼요.
          </DialogDescription>
        </DialogHeader>

        <ActionForm action={createLibrary} submitLabel="만들기" className="grid gap-3">
          <Field name="slug" label="slug" placeholder="my-project" required />
          <Field name="name" label="이름" placeholder="My Project" required />
          <Field
            multiline
            name="github_repos"
            label="이 라이브러리를 보는 GitHub 레포 (선택)"
            placeholder={"acme/web\nacme/api"}
            hint="한 줄에 하나씩. 조직 전체는 acme/* 한 줄이면 돼요"
          />
          <Field
            name="mattermost_webhook_url"
            label="Mattermost webhook (선택)"
            placeholder="https://…/hooks/…"
          />
          <Field
            name="discord_webhook_url"
            label="Discord webhook (선택)"
            placeholder="https://discord.com/api/webhooks/…"
          />
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
