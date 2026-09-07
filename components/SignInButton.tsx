"use client";

/**
 * @file components/SignInButton.tsx
 * @description 구글 로그인 제출 버튼. 누르면 OAuth 리다이렉트까지 잠깐 틈이 있는데,
 * 그동안 아무 반응이 없으면 사람이 다시 누른다. useFormStatus로 그 틈을 메운다.
 *
 * `useFormStatus`는 **폼 안에서만** 동작한다 — 이 컴포넌트를 <form> 밖에 두면
 * pending이 영원히 false다. 폼 자체(서버 액션)는 서버 컴포넌트가 갖고 있는다.
 */
import { ArrowRight } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { Dict } from "@/lib/i18n.en";

interface SignInButtonProps {
  /** 랜딩의 큰 버튼(true) 또는 헤더의 텍스트 버튼(false) */
  hero?: boolean;
  /** 서버 컴포넌트가 골라 내려 준다 — 클라이언트가 사전 두 벌을 번들에 싣지 않게 */
  t: Dict["common"];
}

export function SignInButton({ hero = false, t }: SignInButtonProps) {
  const { pending } = useFormStatus();

  if (!hero) {
    // 헤더에서도 외곽선 버튼이다. 맨 텍스트로 두면 옆의 언어 선택·탐색 링크와 같은 무게로
    // 보여서, 비로그인이 처음 해야 할 한 가지가 헤더에서 눈에 띄지 않는다
    return (
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? t.signingIn : t.signIn}
      </Button>
    );
  }

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? t.signInWithGoogleBusy : t.signInWithGoogle} <ArrowRight />
    </Button>
  );
}
