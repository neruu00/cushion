"use client";

/**
 * @file components/LibrarySettingsDialog.tsx
 * @description 이미 만든 라이브러리의 설정 — 이름 · GitHub 레포 · 알림 채널.
 *
 * 현재 값을 그대로 보여준다. 웹훅 URL은 그 채널에 글을 쓸 수 있는 값이지만, 이 화면을 보는
 * 사람은 이미 문서 전체를 읽고 쓰는 멤버다. 가리면 "지금 어느 채널에 붙어 있나"를 아무도
 * 확인할 수 없게 되는데, 그게 더 나쁘다.
 *
 * **slug는 여기 없다.** 바꾸는 순간 팀원이 쓰던 URL과 에이전트가 쓰던 `library` 인자가
 * 죽는다. 옮길 방법을 만들기 전에는 열지 않는다.
 */
import { Settings } from "lucide-react";

import { updateLibrary } from "@/actions/library";
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

interface LibrarySettingsDialogProps {
  libraryId: string;
  name: string;
  githubRepos: string[];
  mattermostWebhookUrl: string | null;
  discordWebhookUrl: string | null;
}

export function LibrarySettingsDialog({
  libraryId,
  name,
  githubRepos,
  mattermostWebhookUrl,
  discordWebhookUrl,
}: LibrarySettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Settings /> 설정
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>라이브러리 설정</DialogTitle>
          <DialogDescription>
            <strong>칸을 비우면 지워져요.</strong> slug는 여기서 바꿀 수 없어요 — 바꾸면 팀원의
            URL과 에이전트가 쓰던 <code>library</code> 인자가 깨져요.
          </DialogDescription>
        </DialogHeader>

        {/*
          key로 리마운트한다. 저장이 끝나면 다이얼로그가 열린 채로 서버가 새 값을 내려보내는데
          (revalidatePath), 언컨트롤드 입력은 초기화 이후 바뀐 defaultValue를 반영하지 못한다 —
          Base UI가 그걸 경고로 알려준다. 컨트롤드로 바꿔도 그 상태의 출처는 결국 같은 서버 값이다.
        */}
        <ActionForm action={updateLibrary} submitLabel="저장" className="grid gap-3">
          <input type="hidden" name="library_id" value={libraryId} />
          <Field key={`nm:${name}`} name="name" label="이름" defaultValue={name} required />
          <Field
            multiline
            key={`gh:${githubRepos.join(",")}`}
            name="github_repos"
            label="이 라이브러리를 보는 GitHub 레포"
            placeholder={"acme/web\nacme/api"}
            hint="한 줄에 하나씩. 조직 전체는 acme/* 한 줄이면 돼요"
            defaultValue={githubRepos.join("\n")}
          />
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
