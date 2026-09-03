/**
 * @file app/invite/[token]/page.tsx
 * @description 초대 링크 진입점 (D-023). 소유자가 만든 링크 하나로 로그인만 하면 참여한다.
 *
 * GET에서 바로 멤버로 만들지 않는다 — 조회는 부작용이 없어야 한다(링크 미리보기 크롤러,
 * 두 번 클릭 등). 참여는 이 페이지의 버튼이 누르는 별도 폼 제출(`joinLibrary`)이 한다.
 *
 * 로그인 안 됐으면 `/api/auth/signin`으로 보내고 돌아올 곳은 이 페이지 자신이다 — 그래야
 * 구글 로그인 뒤 토큰을 다시 안 붙여도 된다.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { joinLibrary } from "@/actions/library";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { getMemberLibrary, getSessionEmail, libraryFromInviteToken } from "@/lib/authz";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;

  const email = await getSessionEmail();
  if (!email) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const library = await libraryFromInviteToken(token);
  if (!library) {
    return (
      <PageShell className="space-y-4">
        <PageHeader title="유효하지 않은 링크예요" />
        <p className="text-sm text-muted-foreground">
          이미 무효화됐거나 잘못된 링크예요. 소유자에게 새 링크를 요청하세요.
        </p>
      </PageShell>
    );
  }

  // getMemberLibrary가 null이 아니면 이미 멤버다 — 토큰을 다시 조회하지 않고 이 값으로 안다.
  const alreadyMember = await getMemberLibrary(email, library.slug);

  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="라이브러리 초대"
        description={
          <>
            <span className="font-mono">{library.slug}</span> · {library.name}
          </>
        }
      />

      {alreadyMember ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">이미 이 라이브러리의 멤버예요.</p>
          <Button render={<Link href={`/libraries/${library.slug}`} />} nativeButton={false}>
            라이브러리로 이동
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            참여하면 이 라이브러리의 문서를 읽고 쓸 수 있어요.
          </p>
          <form action={joinLibrary}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit">참여하기</Button>
          </form>
        </div>
      )}
    </PageShell>
  );
}
