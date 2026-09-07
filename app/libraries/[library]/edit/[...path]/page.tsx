/**
 * @file app/[library]/edit/[...path]/page.tsx
 * @description 문서 편집. 정적 `edit` 세그먼트가 `[...path]`보다 먼저 잡히므로
 *              `/[library]/{path}/edit`이 아니라 `/[library]/edit/{path}`다.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { removeDocument } from "@/actions/document";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DocumentForm } from "@/components/DocumentForm";
import { getMemberLibrary, getSessionEmail } from "@/lib/authz";
import { getDict } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

export default async function EditDocumentPage({
  params,
}: PageProps<"/libraries/[library]/edit/[...path]">) {
  const { library: slug, path } = await params;
  const docPath = path.join("/");
  const t = (await getDict()).doc;

  const email = await getSessionEmail();
  if (!email) {
    redirect(
      `/api/auth/signin?callbackUrl=${encodeURIComponent(`/libraries/${slug}/edit/${docPath}`)}`,
    );
  }

  // 멤버가 아니면 404. 읽기와 쓰기의 문턱이 같다 — 볼 수 있으면 고칠 수 있다.
  const library = await getMemberLibrary(email, slug);
  if (!library) notFound();

  const { data: doc, error } = await supabase
    .from("documents")
    .select("path, content, content_sha")
    .eq("library_id", library.id)
    .eq("path", docPath)
    .maybeSingle();

  if (error) console.error("EditDocumentPage", error);
  if (!doc) notFound();

  return (
    <PageShell className="space-y-6">
      <PageHeader
        breadcrumb={
          <>
            <Link href={`/libraries/${library.slug}`} className="font-mono hover:text-foreground">
              {library.slug}
            </Link>
            {" / "}
            <Link
              href={`/libraries/${library.slug}/${doc.path}`}
              className="font-mono hover:text-foreground"
            >
              {doc.path}
            </Link>
          </>
        }
        title={t.editTitle}
        description={
          <Link
            href={`/libraries/${library.slug}/history/${doc.path}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t.changeHistory}
          </Link>
        }
      />

      <DocumentForm
        library={library.slug}
        path={doc.path}
        content={doc.content}
        sha={doc.content_sha}
        t={t}
      />

      <section className="space-y-2 border-t pt-4">
        <h2 className="text-sm font-medium">{t.deleteHeading}</h2>
        <p className="text-sm text-muted-foreground">{t.deleteHelp}</p>
        <ConfirmDialog
          trigger={t.deleteTrigger}
          triggerVariant="destructive"
          triggerSize="sm"
          title={t.deleteConfirmTitle}
          confirmLabel={t.deleteHeading}
          destructive
          description={
            <>
              <span className="block font-mono text-xs">{doc.path}</span>
              <span className="mt-2 block">{t.deleteConfirmBody}</span>
            </>
          }
          formId="delete-document"
        >
          <form id="delete-document" action={removeDocument}>
            <input type="hidden" name="library" value={library.slug} />
            <input type="hidden" name="path" value={doc.path} />
            <input type="hidden" name="base_sha" value={doc.content_sha} />
          </form>
        </ConfirmDialog>
      </section>
    </PageShell>
  );
}
