/**
 * @file app/[library]/edit/[...path]/page.tsx
 * @description 문서 편집. 정적 `edit` 세그먼트가 `[...path]`보다 먼저 잡히므로
 *              `/[library]/{path}/edit`이 아니라 `/[library]/edit/{path}`다.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { removeDocument } from "@/actions/document";
import { DocumentForm } from "@/components/DocumentForm";
import { Button } from "@/components/ui/button";
import { getAccessibleLibrary, getSessionEmail } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

export default async function EditDocumentPage({ params }: PageProps<"/libraries/[library]/edit/[...path]">) {
  const { library: slug, path } = await params;
  const docPath = path.join("/");

  const email = await getSessionEmail();
  if (!email) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/libraries/${slug}/edit/${docPath}`)}`);
  }

  // 멤버가 아니면 404. 읽기와 쓰기의 문턱이 같다 — 볼 수 있으면 고칠 수 있다.
  const library = await getAccessibleLibrary(email, slug);
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
    <main className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href={`/libraries/${library.slug}`} className="font-mono hover:text-foreground">
            {library.slug}
          </Link>
          {" / "}
          <Link href={`/libraries/${library.slug}/${doc.path}`} className="font-mono hover:text-foreground">
            {doc.path}
          </Link>
        </p>
        <h1 className="text-xl font-semibold">편집</h1>
        <p className="text-xs text-muted-foreground">
          <Link
            href={`/libraries/${library.slug}/history/${doc.path}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            변경 이력
          </Link>
        </p>
      </header>

      <DocumentForm library={library.slug} path={doc.path} content={doc.content} sha={doc.content_sha} />

      <section className="space-y-2 border-t pt-4">
        <h2 className="text-sm font-medium">삭제</h2>
        <p className="text-sm text-muted-foreground">
          이전 본문은 이력에 남고, 이력 화면에서 되돌릴 수 있다. 목차에서만 사라진다.
        </p>
        <form action={removeDocument}>
          <input type="hidden" name="library" value={library.slug} />
          <input type="hidden" name="path" value={doc.path} />
          <input type="hidden" name="base_sha" value={doc.content_sha} />
          <Button type="submit" variant="destructive" size="sm">
            이 문서 삭제
          </Button>
        </form>
      </section>
    </main>
  );
}
