/**
 * @file proxy.ts
 * @description `/admin`, `/settings` 로그인 게이트. Next 16에서 middleware.ts → proxy.ts.
 *
 * ⚠️ 이건 UX용이다. 권한의 실체가 아니다.
 *    - 서버 액션은 매처가 제외한 경로에서도 호출될 수 있어 여기를 안 탄다
 *    - admin 여부는 여기서 보지 않는다 (세션 유무만 본다)
 *    실제 검사는 각 서버 액션·라우트 핸들러가 스스로 한다. (SPEC §6)
 */
import { auth } from "@/lib/auth";

export const proxy = auth((req) => {
  if (req.auth) return;

  const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
  return Response.redirect(signInUrl);
});

export const config = {
  matcher: ["/admin/:path*", "/settings/:path*"],
};
