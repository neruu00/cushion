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

interface SignInButtonProps {
  /** 랜딩의 큰 버튼(true) 또는 헤더의 텍스트 버튼(false) */
  hero?: boolean;
}

export function SignInButton({ hero = false }: SignInButtonProps) {
  const { pending } = useFormStatus();

  if (!hero) {
    return (
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer hover:text-foreground disabled:cursor-default disabled:opacity-60"
      >
        {pending ? "이동 중…" : "로그인"}
      </button>
    );
  }

  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? "Google로 이동 중…" : "Google로 시작하기"} <ArrowRight />
    </Button>
  );
}
