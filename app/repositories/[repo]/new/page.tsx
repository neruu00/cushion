/**
 * @file app/[repo]/new/page.tsx
 * @description 새 문서. 경로는 `.md`로 끝나야 한다 — 목차·섹션 조회가 전부 마크다운을 전제한다.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DocumentForm } from "@/components/DocumentForm";
import { getAccessibleRepo, getSessionEmail } from "@/lib/authz";

export default async function NewDocumentPage({ params }: PageProps<"/repositories/[repo]/new">) {
  const { repo: slug } = await params;

  const email = await getSessionEmail();
  if (!email) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/repositories/${slug}/new`)}`);

  const repo = await getAccessibleRepo(email, slug);
  if (!repo) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href={`/repositories/${repo.slug}`} className="font-mono hover:text-foreground">
            {repo.slug}
          </Link>
        </p>
        <h1 className="text-xl font-semibold">새 문서</h1>
      </header>

      <DocumentForm repo={repo.slug} path="" content="" sha="" />
    </main>
  );
}
