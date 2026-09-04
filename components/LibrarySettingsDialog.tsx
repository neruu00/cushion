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
  /** 켜면 링크를 아는 누구나 로그인 없이 문서를 읽는다 (D-024) */
  isPublic: boolean;
}

export function LibrarySettingsDialog({
  libraryId,
  name,
  githubRepos,
  mattermostWebhookUrl,
  discordWebhookUrl,
  isPublic,
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
            <strong>칸을 비우면 그 값이 지워져요.</strong> slug는 여기서 바꿀 수 없어요.
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
            hint="한 줄에 하나씩 적어 주세요. 조직 전체를 지정하려면 acme/* 한 줄이면 돼요"
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
              <span className="font-medium">링크가 있으면 누구나 읽기</span>
              <span className="text-xs font-normal text-muted-foreground">
                켜면 <strong className="text-foreground">로그인하지 않은 사람도</strong> 문서를
                읽어요. 쓰기와 이력, 멤버 목록은 그대로 멤버에게만 보여요. 검색엔진에 올라가지는
                않지만 <strong className="text-foreground">링크를 받은 사람은 누구나</strong> 볼 수
                있어요.
              </span>
            </span>
          </label>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
