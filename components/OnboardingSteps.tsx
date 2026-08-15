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
import { SkillInstall } from "@/components/SkillInstall";

interface OnboardingStepsProps {
  /** 1단계에 놓을 것. 토큰 발급 폼이거나, 랜딩의 자리표시 명령이거나 */
  connectSlot: React.ReactNode;
  skillsUrl: string;
}

export function OnboardingSteps({ connectSlot, skillsUrl }: OnboardingStepsProps) {
  return (
    <ol className="space-y-6">
      <Step n="1" title="연결하기" hint="셸에서 한 번. 이때부터 doc_* 툴이 보여요">
        {connectSlot}
      </Step>

      <Step n="2" title="스킬 설치하기" hint="선택이지만 권장 — 없어도 기본 동작은 해요">
        <SkillInstall skillsUrl={skillsUrl} />
      </Step>

      <Step
        n="3"
        title="어느 라이브러리를 볼지 정하기"
        hint="AGENTS.md에 한 줄. 다음 세션의 방아쇠예요"
      >
        <CopyBlock value="/cushion-use" label="에이전트에게" />
        <p className="text-sm text-muted-foreground">
          이 프로젝트가 볼 라이브러리를 <code>git remote</code>로 찾아 <code>AGENTS.md</code>에
          적어 둬요. <strong>아직 라이브러리가 없으면</strong> 만들지 물어봐요.
          <br />
          팀원이 이미 <code>AGENTS.md</code>를 커밋해 뒀다면 이 단계는 건너뛰어도 돼요 —
          ①만 하면 바로 읽을 수 있어요.
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
