"use client";

/**
 * @file components/SkillInstall.tsx
 * @description 스킬 설치 안내. 어디에 심을지를 탭으로 고른다.
 *
 * 명령이 아니라 **문장**을 준다. `curl` 한 줄은 Windows에서 `mkdir -p`가 없어 깨지고,
 * 파일이 여러 개면 더 나빠진다. 대상 사용자는 이미 에이전트를 쓰는 사람들이라
 * "fetch 해서 저장해줘"가 OS·셸과 무관하게 가장 잘 먹는다.
 */
import { CopyBlock } from "@/components/CopyBlock";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SkillInstallProps {
  skillsUrl: string;
}

export function SkillInstall({ skillsUrl }: SkillInstallProps) {
  const sentence = (root: string) =>
    `${skillsUrl} 를 받아서 files의 각 항목을 ${root}<path> 로 저장해줘. 이미 있으면 덮어써도 된다.`;

  return (
    <Tabs defaultValue="user">
      <TabsList>
        <TabsTrigger value="user">내 컴퓨터 전체</TabsTrigger>
        <TabsTrigger value="project">이 프로젝트만</TabsTrigger>
      </TabsList>

      <TabsContent value="user" className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <code>~/.claude/skills/</code> 에 설치해요. 한 번 설치하면{" "}
          <strong>모든 프로젝트</strong>에서 쓸 수 있어요. 스킬 파일에는 프로젝트 정보가 없어서
          보통 이쪽이 맞아요.
        </p>
        <CopyBlock value={sentence("~/.claude/skills/")} label="에이전트에게 그대로" />
      </TabsContent>

      <TabsContent value="project" className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <code>.claude/skills/</code> 에 설치해요. 커밋하면 <strong>팀 전원</strong>이 자동으로
          받아요. 대신 프로젝트마다 설치해야 하고, 나중에 스킬이 갱신돼도 커밋된 사본은
          그대로예요.
        </p>
        <CopyBlock value={sentence(".claude/skills/")} label="에이전트에게 그대로" />
      </TabsContent>
    </Tabs>
  );
}
