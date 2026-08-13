/**
 * @file app/[repo]/[...path]/page.tsx
 * @description 문서 보기 (T-502).
 *
 * 원본이 여기 있으므로 편집 링크가 있다 (D-011). GitHub 링크는 문서가 아니라
 * "관련 코드 레포"를 가리킨다 — 문서는 더 이상 그 레포에 없다.
 */
import { ExternalLink, History, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Markdown } from "@/components/Markdown";
import { getAccessibleRepo, getSessionEmail } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

export default async function DocumentPage({ params }: PageProps<"/repositories/[repo]/[...path]">) {
  const { repo: slug, path } = await params;
  const docPath = path.join("/");

  const email = await getSessionEmail();
  if (!email) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/repositories/${slug}/${docPath}`)}`);
  }

  const repo = await getAccessibleRepo(email, slug);
  if (!repo) notFound();

  const { data: doc, error } = await supabase
    .from("documents")
    .select("path, title, content, updated_at, updated_by")
    .eq("repository_id", repo.id)
    .eq("path", docPath)
    .maybeSingle();

  if (error) console.error("DocumentPage", error);
  if (!doc) notFound();

  // 문서는 여기 있고 레포는 관련 코드일 뿐이다 — 문서 파일이 아니라 레포로 건다.
  const source = repo.github_full_name
    ? `https://github.com/${repo.github_full_name}`
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <header className="space-y-2 border-b pb-4">
        <p className="text-xs text-muted-foreground">
          <Link href={`/repositories/${repo.slug}`} className="font-mono hover:text-foreground">
            {repo.slug}
          </Link>
          {" / "}
          <span className="font-mono">{doc.path}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            {doc.updated_at.slice(0, 10)}
            {doc.updated_by ? ` · ${doc.updated_by}` : ""}
          </span>
          <Link
            href={`/repositories/${repo.slug}/edit/${doc.path}`}
            className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
          >
            편집 <Pencil className="size-3" />
          </Link>
          <Link
            href={`/repositories/${repo.slug}/history/${doc.path}`}
            className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
          >
            이력 <History className="size-3" />
          </Link>
          {source ? (
            <a
              href={source}
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              관련 레포 <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </header>

      <Markdown>{doc.content}</Markdown>
    </main>
  );
}
