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
import { Fill } from "@/components/Fill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Dict } from "@/lib/i18n.en";
import { fill } from "@/lib/utils";

interface SkillInstallProps {
  skillsUrl: string;
  /** 서버 컴포넌트(`OnboardingSteps`)가 고른 언어 조각만 내려 준다 */
  t: Dict["skillInstall"];
}

interface ScopeOption {
  root: string;
  label: string;
  hint: React.ReactNode;
}

export function SkillInstall({ skillsUrl, t }: SkillInstallProps) {
  const sentence = (root: string) => fill(t.sentence, { url: skillsUrl, root });

  const scopes = (options: ScopeOption[]) => (
    <div className="space-y-4">
      {options.map((option) => (
        <div key={option.root} className="space-y-2">
          <h4 className="text-sm font-medium">{option.label}</h4>
          <p className="text-sm text-muted-foreground">{option.hint}</p>
          <CopyBlock
            value={sentence(option.root)}
            label={fill(t.copyLabel, { root: option.root })}
          />
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
            label: t.everywhere,
            hint: (
              <Fill
                template={t.claudeGlobal}
                parts={{
                  path: <code>~/.claude/skills/</code>,
                  scope: <strong>{t.claudeGlobalScope}</strong>,
                }}
              />
            ),
          },
          {
            root: ".claude/skills/",
            label: t.thisProject,
            hint: (
              <Fill
                template={t.claudeProject}
                parts={{
                  path: <code>.claude/skills/</code>,
                  scope: <strong>{t.claudeProjectScope}</strong>,
                }}
              />
            ),
          },
        ])}
      </TabsContent>

      <TabsContent value="antigravity">
        {scopes([
          {
            root: "~/.gemini/config/skills/",
            label: t.everywhere,
            hint: (
              <Fill
                template={t.antigravityGlobal}
                parts={{ path: <code>~/.gemini/config/skills/</code> }}
              />
            ),
          },
          {
            root: ".agents/skills/",
            label: t.thisProject,
            hint: (
              <Fill
                template={t.antigravityProject}
                parts={{ path: <code>.agents/skills/</code> }}
              />
            ),
          },
        ])}
      </TabsContent>

      <TabsContent value="codex">
        {scopes([
          {
            root: "~/.agents/skills/",
            label: t.everywhere,
            hint: (
              <Fill template={t.codexGlobal} parts={{ path: <code>~/.agents/skills/</code> }} />
            ),
          },
          {
            root: ".agents/skills/",
            label: t.thisProject,
            hint: <Fill template={t.codexProject} parts={{ path: <code>.agents/skills/</code> }} />,
          },
        ])}
      </TabsContent>
    </Tabs>
  );
}
