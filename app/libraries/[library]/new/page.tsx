/**
 * @file app/[library]/new/page.tsx
 * @description 새 문서. 경로는 `.md`로 끝나야 한다 — 목차·섹션 조회가 전부 마크다운을 전제한다.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { DocumentForm } from "@/components/DocumentForm";
import { getAccessibleLibrary, getSessionEmail } from "@/lib/authz";

export default async function NewDocumentPage({ params }: PageProps<"/libraries/[library]/new">) {
  const { library: slug } = await params;

  const email = await getSessionEmail();
  if (!email) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/libraries/${slug}/new`)}`);

  const library = await getAccessibleLibrary(email, slug);
  if (!library) notFound();

  return (
    <PageShell className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link href={`/libraries/${library.slug}`} className="font-mono hover:text-foreground">
            {library.slug}
          </Link>
        }
        title="새 문서"
      />

      <DocumentForm library={library.slug} path="" content="" sha="" />
    </PageShell>
  );
}
