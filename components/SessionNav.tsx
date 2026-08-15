/**
 * @file components/SessionNav.tsx
 * @description 헤더 오른쪽 — 로그인 상태에 따라 달라지는 부분.
 *
 * 루트 레이아웃에서 떼어낸 이유는 **여기만 요청마다 달라지기 때문**이다. 나머지 헤더와
 * 문서 화면은 누구에게나 같다. 이 컴포넌트가 분리돼 있으면 나중에 `<Suspense>`로 감싸
 * 정적 셸을 먼저 내보낼 수 있다 — 지금은 감싸지 않았고, 그건 `cacheComponents` 도입과
 * 함께 할 일이다.
 *
 * 서버 컴포넌트다. 세션을 읽으므로 클라이언트로 내려가면 안 된다.
 */
import Link from "next/link";

import { signInWithGoogle, signOutEverywhere } from "@/actions/session";
import { getSessionEmail, isAdminEmail } from "@/lib/authz";

export async function SessionNav() {
  const email = await getSessionEmail();

  if (!email) {
    return (
      <form action={signInWithGoogle}>
        <button type="submit" className="cursor-pointer hover:text-foreground">
          로그인
        </button>
      </form>
    );
  }

  return (
    <>
      <Link href="/dashboard" className="hover:text-foreground">
        대시보드
      </Link>
      {/* 링크가 보이는 것과 들어갈 수 있는 것은 별개다. 실제 판정은 각 페이지가 한다 */}
      {isAdminEmail(email) && (
        <Link href="/admin" className="hover:text-foreground">
          관리
        </Link>
      )}
      <Link href="/settings/tokens" className="hover:text-foreground">
        토큰
      </Link>
      <span className="hidden font-mono text-xs sm:inline">{email}</span>
      <form action={signOutEverywhere}>
        <button type="submit" className="cursor-pointer hover:text-foreground">
          로그아웃
        </button>
      </form>
    </>
  );
}
