"use client";

/**
 * @file components/LibrarySettingsDialog.tsx
 * @description 이미 만든 라이브러리의 설정 — 이름 · GitHub 레포 · 알림 채널.
 *
 * 소유자만 이 컴포넌트를 받는다(D-021) — 부모(`app/libraries/[library]/page.tsx`)가
 * `isOwner`일 때만 렌더한다. 지금 어느 채널에 붙어 있는지는 멤버 전원이 알아야 해서
 * 페이지 헤더에 따로 보이고, 여기는 **바꾸는** 권한만 좁힌다.
 *
 * **slug는 여기 없다.** 바꾸는 순간 팀원이 쓰던 URL과 에이전트가 쓰던 `library` 인자가
 * 죽는다. 옮길 방법을 만들기 전에는 열지 않는다.
 */
import { Settings } from "lucide-react";

import { updateLibrary } from "@/actions/library";
import { ActionForm } from "@/components/ActionForm";
import { Fill } from "@/components/Fill";
import { Field } from "@/components/Field";
import type { Dict } from "@/lib/i18n.en";
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
  /** 켜면 링크를 아는 누구나 로그인 없이 문서를 읽는다 (D-024) */
  isPublic: boolean;
  /** 서버 페이지가 고른 언어 조각 */
  t: Dict["librarySettings"];
  common: Dict["common"];
}

export function LibrarySettingsDialog({
  libraryId,
  name,
  githubRepos,
  mattermostWebhookUrl,
  discordWebhookUrl,
  isPublic,
  t,
  common,
}: LibrarySettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Settings /> {t.trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        {/*
          key로 리마운트한다. 저장이 끝나면 다이얼로그가 열린 채로 서버가 새 값을 내려보내는데
          (revalidatePath), 언컨트롤드 입력은 초기화 이후 바뀐 defaultValue를 반영하지 못한다 —
          Base UI가 그걸 경고로 알려준다. 컨트롤드로 바꿔도 그 상태의 출처는 결국 같은 서버 값이다.
        */}
        <ActionForm action={updateLibrary} submitLabel={common.save} className="grid gap-3">
          <input type="hidden" name="library_id" value={libraryId} />
          <Field key={`nm:${name}`} name="name" label={common.name} defaultValue={name} required />
          <Field
            multiline
            key={`gh:${githubRepos.join(",")}`}
            name="github_repos"
            label={t.githubLabel}
            placeholder={"acme/web\nacme/api"}
            hint={t.githubHint}
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

          {/* 체크박스라 Field(라벨+입력 한 쌍)에 안 맞는다 — 라벨이 옆에 붙어야 한다.
              defaultChecked도 defaultValue와 같은 이유로 key 리마운트가 필요하다 */}
          <label
            key={`pub:${isPublic}`}
            className="flex items-start gap-2 rounded-lg border p-3 text-sm"
          >
            <input
              type="checkbox"
              name="is_public"
              defaultChecked={isPublic}
              className="mt-0.5 size-4 shrink-0 accent-foreground"
            />
            <span className="grid gap-1">
              <span className="font-medium">{t.publicLabel}</span>
              <span className="text-xs font-normal text-muted-foreground">
                <Fill
                  template={t.publicHint}
                  parts={{
                    who: <strong className="text-foreground">{t.publicWho}</strong>,
                    anyone: <strong className="text-foreground">{t.publicAnyone}</strong>,
                  }}
                />
              </span>
            </span>
          </label>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
