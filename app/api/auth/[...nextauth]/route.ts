/**
 * @file app/api/auth/[...nextauth]/route.ts
 * @description NextAuth 콜백 엔드포인트. 설정은 전부 lib/auth.ts에 있다.
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
