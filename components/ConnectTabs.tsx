"use client";

/**
 * @file components/ConnectTabs.tsx
 * @description 연결 스니펫을 클라이언트별 탭으로 보여준다. `SkillInstall`과 같은 모양이다 —
 * ①(연결)과 ②(스킬 설치) 둘 다 "클라이언트를 먼저 고른다"는 같은 판단이라 같은 UI를 쓴다.
 *
 * 순수 표시 컴포넌트다 — 토큰도 baseUrl도 모른다. 스니펫 문자열은 호출부가 이미 만들어서
 * 넘긴다(서버 컴포넌트 `/docs/install`는 그 자리에서, `/settings/tokens`는 서버 액션에서).
 * `baseUrl()`이 서버 전용 환경변수를 읽으므로 클라이언트 컴포넌트에서 직접 부를 수 없다.
 */
import { CopyBlock } from "@/components/CopyBlock";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface ConnectGroup {
  /** 탭을 고르는 값. 그룹 사이에서 겹치지만 않으면 된다(공백도 허용) */
  key: string;
  /** 탭에 보이는 이름 */
  label: string;
  items: { label: string; content: string }[];
}

interface ConnectTabsProps {
  groups: ConnectGroup[];
}

export function ConnectTabs({ groups }: ConnectTabsProps) {
  return (
    <Tabs defaultValue={groups[0]?.key}>
      <TabsList>
        {groups.map((group) => (
          <TabsTrigger key={group.key} value={group.key}>
            {group.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {groups.map((group) => (
        <TabsContent key={group.key} value={group.key} className="space-y-3">
          {group.items.map((item) => (
            <CopyBlock key={item.label} value={item.content} label={item.label} />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  );
}
