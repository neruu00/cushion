/**
 * @file lib/auth.ts
 * @description NextAuth v5 Google. 세션에는 lowercase 이메일만 담는다.
 *
 * DB 어댑터를 붙이지 않는다 — 유저 테이블이 없기 때문이다(D-003).
 * 정체성은 여기가, 접근 허용 여부는 `repository_members` 행 존재가 결정한다.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Auth.js 기본 탐색 이름은 AUTH_GOOGLE_ID/SECRET이라 자동으로 읽지 못한다.
    // SPEC §10의 이름을 그대로 쓰기 위해 명시 주입한다. (NEXTAUTH_URL/SECRET은 자동 인식)
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    jwt({ token }) {
      // 대소문자 차이가 곧 ACL 우회 구멍이다. 세션에 들어가는 순간 정규화한다. (SPEC §6)
      if (token.email) token.email = token.email.toLowerCase();
      // 권한 판단에 쓰는 건 이메일 하나뿐이다. 나머지는 쿠키에 싣지 않는다.
      delete token.name;
      delete token.picture;
      return token;
    },
  },
});
