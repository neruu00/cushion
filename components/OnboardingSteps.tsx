/**
 * @file components/OnboardingSteps.tsx
 * @description 붙이는 순서 3단계. 토큰 화면과 랜딩이 **같은 것**을 쓴다.
 *
 * 안내를 화면마다 따로 쓰면 한쪽만 고치는 날이 온다. 순서가 실제로 중요해서 더 그렇다 —
 * ①이 없으면 ②의 스킬이 부를 툴이 없고, ③이 없으면 다음 세션에 아무 일도 안 일어난다
 * (로컬에 문서가 없는 게 이 구조의 정상 상태라, AGENTS.md 한 줄이 유일한 방아쇠다).
 *
 * 1단계 자리는 슬롯이다. 토큰 화면은 거기에 발급 폼을 넣어 **발급 결과가 곧 1단계**가 되게
 * 하고, 랜딩은 자리표시 명령만 보여준다. 안 그러면 같은 명령이 화면에 두 번 나온다.
 *
 * 서버 컴포넌트다. 클라이언트가 필요한 건 복사 버튼과 탭뿐이라 그것만 리프로 내려간다.
 */
import { CopyBlock } from "@/components/CopyBlock";
import { Fill } from "@/components/Fill";
import { SkillInstall } from "@/components/SkillInstall";
import { getDict } from "@/lib/i18n";

interface OnboardingStepsProps {
  /** 1단계에 놓을 것. 토큰 발급 폼이거나, 랜딩의 자리표시 명령이거나 */
  connectSlot: React.ReactNode;
  skillsUrl: string;
}

export async function OnboardingSteps({ connectSlot, skillsUrl }: OnboardingStepsProps) {
  const t = await getDict();
  const o = t.onboarding;

  return (
    <ol className="space-y-6">
      <Step n="1" title={o.step1} hint={o.step1Hint}>
        {connectSlot}
      </Step>

      <Step n="2" title={o.step2} hint={o.step2Hint}>
        <SkillInstall skillsUrl={skillsUrl} t={t.skillInstall} />
      </Step>

      <Step n="3" title={o.step3} hint={o.step3Hint}>
        <CopyBlock value="/cushion-use" label={o.sendToAgent} />
        <p className="text-sm text-muted-foreground">
          <Fill
            template={o.step3Body}
            parts={{
              remote: <code>git remote</code>,
              file: <code>AGENTS.md</code>,
            }}
          />
        </p>
      </Step>
    </ol>
  );
}

interface StepProps {
  n: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}

function Step({ n, title, hint, children }: StepProps) {
  return (
    <li className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
          {n}
        </span>
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="space-y-2 pl-7">{children}</div>
    </li>
  );
}
