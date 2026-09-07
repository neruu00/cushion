"use client";

/**
 * @file components/UiCopyProvider.tsx
 * @description 어느 화면에나 나오는 **공용 문구**(버튼·복사·확인)를 클라이언트 리프에 전달한다.
 *
 * 이것만 컨텍스트인 이유: `CopyBlock`·`ConfirmDialog` 같은 리프는 서버 페이지에서 서너 겹
 * 아래에 있고, 중간의 `OnboardingSteps`·`SkillInstall`·`ConnectTabs`는 그 문구를 쓰지도
 * 않는다. 그런 곳에 `t`를 손으로 꿰면 한 겹만 빠뜨려도 조용히 안 넘어간다.
 *
 * **화면별 문구는 여기 넣지 않는다.** 멤버 다이얼로그·설정 다이얼로그처럼 서버 페이지가
 * 직접 렌더하는 것들은 props로 자기 조각만 받는다 — 사전 전체를 컨텍스트에 실으면
 * 모든 페이지의 RSC 페이로드가 안 쓰는 문구까지 지고 다닌다.
 *
 * ⚠️ 사전 모듈(`lib/i18n.ko.ts`·`lib/i18n.en.ts`)을 여기서 import하지 않는다. 값은 서버가
 *    **고른 언어 하나만** 내려 주고, 여기는 타입만 안다. import하면 두 언어가 통째로
 *    클라이언트 번들에 들어간다.
 */
import { createContext, useContext } from "react";

import type { Dict } from "@/lib/i18n.en";

export type UiCopy = Pick<Dict, "common" | "form">;

const UiCopyContext = createContext<UiCopy | null>(null);

export function UiCopyProvider({ value, children }: { value: UiCopy; children: React.ReactNode }) {
  return <UiCopyContext.Provider value={value}>{children}</UiCopyContext.Provider>;
}

export function useUiCopy(): UiCopy {
  const copy = useContext(UiCopyContext);
  // 없이 렌더되면 문구가 빈칸으로 나가는 대신 여기서 멈춘다 — 빈 버튼은 눈에 안 띈다
  if (!copy) throw new Error("useUiCopy: UiCopyProvider 밖에서 불렀다");
  return copy;
}
