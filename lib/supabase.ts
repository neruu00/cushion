/**
 * @file lib/supabase.ts
 * @description service_role 단일 Supabase 클라이언트.
 *
 * ⚠️ RLS가 없다. 테이블에 RLS는 켜져 있지만 정책이 0개이고, 그건 anon 키가 유출됐을 때
 *    전부 거부시키기 위한 fail-closed 장치일 뿐이다. service_role은 RLS를 우회하므로
 *    이 클라이언트에는 아무 제약이 없다.
 *
 *    따라서 권한 검사는 전적으로 호출부(서버 액션 · 라우트 핸들러)의 책임이다.
 *    proxy.ts는 서버 액션 호출을 막지 못한다 — 그것만 믿고 액션에서 검사를 생략하면 그대로 뚫린다.
 *    (SPEC §6)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 부팅 시점에 죽는 편이 낫다. 런타임에 정체불명의 401을 받는 것보다.
if (!url || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았다. .env.example 참조.",
  );
}

// ponytail: 스키마 타입을 생성하지 않는다. 컬럼 오타는 런타임에 잡힌다.
// 테이블이 늘어 손이 아플 때 `supabase gen types typescript`로 올린다.
export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
