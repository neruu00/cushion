"use server";

/**
 * @file actions/session.ts
 * @description 로그인·로그아웃. NextAuth 엔드포인트로 링크를 걸지 않고 폼 액션으로 부른다 —
 *              `/api/auth/*`는 페이지가 아니라 라우트 핸들러라 `<Link>`가 맞지 않고,
 *              로그아웃은 GET이 아니라 CSRF 보호되는 POST여야 한다.
 */
import { signIn, signOut } from "@/lib/auth";

/** 프로바이더가 Google 하나뿐이라 중간 선택 화면을 건너뛴다. 로그인하면 대시보드로. */
export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signOutEverywhere(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
