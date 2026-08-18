/**
 * @file lib/auth.ts
 * @description NextAuth v5 Google. 세션에는 lowercase 이메일만 담는다.
 *
 * users 테이블에 로그인 기록을 남긴다. 접근 허용 여부는 `library_members` 행 존재가 결정한다.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { supabase } from "@/lib/supabase";

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
  events: {
    // Why: 로그인만 한 사용자도 관리자 화면에 나오게 하려면 users 행이 있어야 한다.
    // signIn 이벤트는 인증 성공 뒤에 호출되므로 여기서 upsert하면 된다.
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return;
      const { error } = await supabase
        .from("users")
        .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
      if (error) console.error("auth: users upsert", error);
    },
  },
});
