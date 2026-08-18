"use client";

/**
 * @file components/SkillInstall.tsx
 * @description 스킬 설치 안내. 클라이언트를 먼저 고르고, 그 안에서 어디에 심을지 고른다.
 *
 * 명령이 아니라 **문장**을 준다. `curl` 한 줄은 Windows에서 `mkdir -p`가 없어 깨지고,
 * 파일이 여러 개면 더 나빠진다. 대상 사용자는 이미 에이전트를 쓰는 사람들이라
 * "fetch 해서 저장해줘"가 OS·셸과 무관하게 가장 잘 먹는다.
 *
 * SKILL.md(frontmatter의 name·description) 형식 자체는 세 클라이언트가 공유하는 개방
 * 표준이라 파일 내용은 안 바뀐다 — 달라지는 건 **저장 경로**뿐이다. Antigravity와 Codex는
 * 프로젝트 스코프 경로(`.agents/skills/`)가 우연히 같아서 묶었다.
 * 출처: antigravity.google/docs/skills, learn.chatgpt.com/docs/build-skills
 */
import { CopyBlock } from "@/components/CopyBlock";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SkillInstallProps {
  skillsUrl: string;
}

interface ScopeOption {
  root: string;
  label: string;
  hint: React.ReactNode;
}

export function SkillInstall({ skillsUrl }: SkillInstallProps) {
  const sentence = (root: string) =>
    `${skillsUrl} 를 받아서 files의 각 항목을 ${root}<path> 로 저장해줘. 이미 있으면 덮어써도 된다.`;

  const scopes = (options: ScopeOption[]) => (
    <div className="space-y-4">
      {options.map((option) => (
        <div key={option.root} className="space-y-2">
          <h4 className="text-sm font-medium">{option.label}</h4>
          <p className="text-sm text-muted-foreground">{option.hint}</p>
          <CopyBlock value={sentence(option.root)} label={`에이전트에게 그대로 — ${option.root}`} />
        </div>
      ))}
    </div>
  );

  return (
    <Tabs defaultValue="claude">
      <TabsList>
        <TabsTrigger value="claude">Claude Code</TabsTrigger>
        <TabsTrigger value="antigravity">Antigravity</TabsTrigger>
        <TabsTrigger value="codex">Codex CLI</TabsTrigger>
      </TabsList>

      <TabsContent value="claude">
        {scopes([
          {
            root: "~/.claude/skills/",
            label: "내 컴퓨터 전체",
            hint: (
              <>
                <code>~/.claude/skills/</code> — 한 번 설치하면 <strong>모든 프로젝트</strong>에서
                써요. 스킬 파일에는 프로젝트 정보가 없어서 보통 이쪽이 맞아요.
              </>
            ),
          },
          {
            root: ".claude/skills/",
            label: "이 프로젝트만",
            hint: (
              <>
                <code>.claude/skills/</code> — 커밋하면 <strong>팀 전원</strong>이 자동으로 받아요.
                대신 프로젝트마다 설치해야 하고, 갱신돼도 커밋된 사본은 그대로예요.
              </>
            ),
          },
        ])}
      </TabsContent>

      <TabsContent value="antigravity">
        {scopes([
          {
            root: "~/.gemini/config/skills/",
            label: "내 컴퓨터 전체",
            hint: (
              <>
                <code>~/.gemini/config/skills/</code> — 모든 프로젝트에서 써요.
              </>
            ),
          },
          {
            root: ".agents/skills/",
            label: "이 프로젝트만",
            hint: (
              <>
                <code>.agents/skills/</code>(프로젝트 루트) — 커밋하면 팀 전원이 받아요. 이 경로는
                Codex CLI와 같아서, 두 클라이언트를 같이 쓰면 한 번만 설치하면 돼요.
              </>
            ),
          },
        ])}
      </TabsContent>

      <TabsContent value="codex">
        {scopes([
          {
            root: "~/.agents/skills/",
            label: "내 컴퓨터 전체",
            hint: (
              <>
                <code>~/.agents/skills/</code> — 모든 저장소에서 써요.
              </>
            ),
          },
          {
            root: ".agents/skills/",
            label: "이 프로젝트만",
            hint: (
              <>
                <code>.agents/skills/</code>(프로젝트 루트) — 커밋하면 팀 전원이 받아요. Antigravity
                프로젝트 스코프와 경로가 같아요.
              </>
            ),
          },
        ])}
      </TabsContent>
    </Tabs>
  );
}
