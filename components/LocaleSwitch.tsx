"use client";

/**
 * @file components/LocaleSwitch.tsx
 * @description 헤더의 언어 선택 드롭다운.
 *
 * **트리거는 지금 보고 있는 언어를 보여준다** — 한국어면 `KO`, 영어면 `EN`. 드롭다운은
 * 열어야 선택지가 보이므로, 닫혀 있을 때 필요한 정보는 "무엇이 될까"가 아니라
 * "지금 무엇인가"다.
 *
 * **폼은 메뉴 밖에 있고, 항목은 `form` 속성으로 거기에 이어 붙는다.** 메뉴 내용은 포털로
 * 떠서 열릴 때만 마운트되는데, 항목을 누르면 메뉴가 닫히면서 그 노드가 사라진다 —
 * 폼을 메뉴 안에 두면 제출이 그 언마운트와 경합한다. `ConfirmDialog`가 확인 버튼을
 * 폼 밖에 두고 `form`으로 잇는 것과 같은 이유다.
 *
 * 항목마다 폼을 두지 않고 **폼 하나에 제출 버튼 둘**을 둔다. 눌린 버튼의 `name`/`value`만
 * 폼 데이터에 실리는 게 HTML 기본 동작이라 `setLocale`이 그대로 받는다.
 *
 * 서버 액션은 서버 컴포넌트(`app/layout.tsx`)에서 prop으로 받는다 — `UserMenu`의
 * 로그아웃과 같은 방식이다.
 *
 * ⚠️ 언어 이름은 사전에서 온다. 영어 화면의 항목을 "한국어"라고 쓰면 그 세 글자 때문에
 *    2MB짜리 Pretendard가 내려온다 (`app/layout.tsx`의 `preload: false` 주석 참고).
 */
import { Check, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n.en";

/** 폼과 버튼을 잇는 id. 헤더에 하나뿐이라 고정값이어도 겹치지 않는다 */
const FORM_ID = "locale-switch";

interface LocaleSwitchProps {
  locale: Locale;
  t: Dict["nav"];
  setLocaleAction: (formData: FormData) => Promise<void>;
}

export function LocaleSwitch({ locale, t, setLocaleAction }: LocaleSwitchProps) {
  const options: { value: Locale; label: string }[] = [
    { value: "ko", label: t.korean },
    { value: "en", label: t.english },
  ];

  return (
    <>
      {/* 안에 아무것도 없어 화면을 차지하지 않는다. 아래 항목들이 `form`으로 여기에 붙는다 */}
      <form id={FORM_ID} action={setLocaleAction} />

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={t.switchLanguage}
          className="flex cursor-pointer items-center gap-1 rounded-md outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:text-foreground"
        >
          <span className="text-xs font-medium">{locale === "ko" ? t.langKo : t.langEn}</span>
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-36">
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              // Menu.Item의 기본 렌더는 <div>라 nativeButton 기본값이 false다.
              // <button>을 끼울 때는 켜 줘야 한다 (UserMenu와 같은 함정)
              nativeButton
              render={
                <button
                  type="submit"
                  form={FORM_ID}
                  name="locale"
                  value={option.value}
                  className="w-full"
                />
              }
            >
              {/* 자리를 늘 비워 둔다 — 고른 항목에만 아이콘이 생기면 글자가 좌우로 흔들린다 */}
              <Check
                className={option.value === locale ? "size-3.5" : "size-3.5 opacity-0"}
                aria-hidden
              />
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
