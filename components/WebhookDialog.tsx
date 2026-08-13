"use client";

/**
 * @file components/WebhookDialog.tsx
 * @description 이미 만든 레포의 알림 채널을 고친다. 레포 페이지의 "알림" 버튼이 연다.
 *
 * 현재 값을 그대로 보여준다. 웹훅 URL은 그 채널에 글을 쓸 수 있는 값이지만, 이 화면을 보는
 * 사람은 이미 스펙 전체를 읽고 쓰는 멤버다. 가리면 "지금 어느 채널에 붙어 있나"를 아무도
 * 확인할 수 없게 되는데, 그게 더 나쁘다.
 */
import { Bell } from "lucide-react";

import { updateWebhooks } from "@/actions/repository";
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

interface WebhookDialogProps {
  repositoryId: string;
  mattermostWebhookUrl: string | null;
  discordWebhookUrl: string | null;
}

export function WebhookDialog({
  repositoryId,
  mattermostWebhookUrl,
  discordWebhookUrl,
}: WebhookDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Bell /> 알림
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>알림 채널</DialogTitle>
          <DialogDescription>
            문서가 바뀔 때마다 무엇이 어떻게 바뀌었는지 이 채널로 간다. 둘 다 둘 수 있고,
            <strong> 칸을 비우면 연결이 끊긴다.</strong>
          </DialogDescription>
        </DialogHeader>

        {/*
          key로 리마운트한다. 저장이 끝나면 다이얼로그가 열린 채로 서버가 새 값을 내려보내는데
          (revalidatePath), 언컨트롤드 입력은 초기화 이후 바뀐 defaultValue를 반영하지 못한다 —
          Base UI가 그걸 경고로 알려준다. 컨트롤드로 바꿔도 그 상태의 출처는 결국 같은 서버 값이다.
        */}
        <ActionForm action={updateWebhooks} submitLabel="저장" className="grid gap-3">
          <input type="hidden" name="repository_id" value={repositoryId} />
          <Field
            key={`mm:${mattermostWebhookUrl ?? ""}`}
            name="mattermost_webhook_url"
            label="Mattermost webhook"
            placeholder="https://…/hooks/…"
            defaultValue={mattermostWebhookUrl ?? ""}
          />
          <Field
            key={`dc:${discordWebhookUrl ?? ""}`}
            name="discord_webhook_url"
            label="Discord webhook"
            placeholder="https://discord.com/api/webhooks/…"
            defaultValue={discordWebhookUrl ?? ""}
          />
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
