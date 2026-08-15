/**
 * @file components/MainNav.tsx
 * @description 헤더 왼쪽의 탐색 링크. 로고 옆에 붙는다 — 탐색은 왼쪽, 계정은 오른쪽.
 *
 * 대시보드는 로그인해야 보인다. 그래서 이 컴포넌트가 세션을 읽는 서버 컴포넌트다 —
 * 링크 목록을 레이아웃에 직접 쓰면 로그인 여부에 따른 분기가 레이아웃으로 샌다.
 */
import { NavLink } from "@/components/NavLink";
import { getSessionEmail } from "@/lib/authz";

export async function MainNav() {
  const email = await getSessionEmail();

  return (
    <>
      <NavLink href="/docs">문서</NavLink>
      {email && <NavLink href="/dashboard">대시보드</NavLink>}
    </>
  );
}
