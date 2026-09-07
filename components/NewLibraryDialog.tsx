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
import type { Dict } from "@/lib/i18n.en";

interface NewLibraryDialogProps {
  /** 서버 페이지가 고른 언어 조각 */
  t: Dict["newLibrary"];
  common: Dict["common"];
}

export function NewLibraryDialog({ t, common }: NewLibraryDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <Plus /> {t.trigger}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <ActionForm action={createLibrary} submitLabel={t.create} className="grid gap-3">
          <Field name="slug" label="slug" placeholder="my-project" required />
          <Field name="name" label={common.name} placeholder="My Project" required />
          <Field
            multiline
            name="github_repos"
            label={t.githubLabel}
            placeholder={"acme/web\nacme/api"}
            hint={t.githubHint}
          />
          <Field
            name="mattermost_webhook_url"
            label={t.mattermost}
            placeholder="https://…/hooks/…"
          />
          <Field
            name="discord_webhook_url"
            label={t.discord}
            placeholder="https://discord.com/api/webhooks/…"
          />
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
