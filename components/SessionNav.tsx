/**
 * @file components/SessionNav.tsx
 * @description 헤더 오른쪽 — 계정 영역. 로그인 버튼이거나 계정 메뉴다.
 *
 * 탐색 링크는 여기 없다 — 왼쪽의 `MainNav`가 맡는다. 탐색과 계정을 한 덩어리로
 * 두면 항목이 늘 때마다 헤더 오른쪽이 자라서 위계가 사라진다.
 *
 * 루트 레이아웃에서 떼어낸 이유는 **여기만 요청마다 달라지기 때문**이다. 나중에
 * `<Suspense>`로 감싸 정적 셸을 먼저 내보낼 수 있다 (PLAN T-504).
 *
 * 서버 컴포넌트다. 세션을 읽으므로 클라이언트로 내려가면 안 된다 — 드롭다운만
 * 클라이언트 리프고, 내용물(이메일·관리자 여부·로그아웃 액션)은 여기서 채워 내린다.
 */
import { signInWithGoogle, signOutEverywhere } from "@/actions/session";
import { SignInButton } from "@/components/SignInButton";
import { UserMenu } from "@/components/UserMenu";
import { getSessionEmail, isAdminEmail } from "@/lib/authz";

export async function SessionNav() {
  const email = await getSessionEmail();

  if (!email) {
    return (
      <form action={signInWithGoogle}>
        <SignInButton />
      </form>
    );
  }

  // 관리 링크가 메뉴 안에 보이는 것과 들어갈 수 있는 것은 별개다. 실제 판정은 각 페이지가 한다
  return <UserMenu email={email} isAdmin={isAdminEmail(email)} signOutAction={signOutEverywhere} />;
}
