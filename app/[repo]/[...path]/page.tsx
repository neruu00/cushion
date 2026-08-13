/**
 * @file app/[repo]/[...path]/page.tsx
 * @description 문서 보기 + GitHub 원본 링크 (T-502).
 *
 * 편집 버튼이 없는 게 맞다. 원본은 git이고 수정은 PR로 한다 (D-001).
 */
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Markdown } from "@/components/Markdown";
import { getAccessibleRepo, getSessionEmail } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

export default async function DocumentPage({ params }: PageProps<"/[repo]/[...path]">) {
  const { repo: slug, path } = await params;
  const docPath = path.join("/");

  const email = await getSessionEmail();
  if (!email) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/${slug}/${docPath}`)}`);
  }

  const repo = await getAccessibleRepo(email, slug);
  if (!repo) notFound();

  const { data: doc, error } = await supabase
    .from("documents")
    .select("path, title, content, updated_at, commit_sha")
    .eq("repository_id", repo.id)
    .eq("path", docPath)
    .maybeSingle();

  if (error) console.error("DocumentPage", error);
  if (!doc) notFound();

  // 브랜치를 저장하지 않으므로 HEAD로 건다. 기본 브랜치가 뭐든 따라간다.
  const source = repo.github_full_name
    ? `https://github.com/${repo.github_full_name}/blob/HEAD/${doc.path}`
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <header className="space-y-2 border-b pb-4">
        <p className="text-xs text-muted-foreground">
          <Link href={`/${repo.slug}`} className="font-mono hover:text-foreground">
            {repo.slug}
          </Link>
          {" / "}
          <span className="font-mono">{doc.path}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{doc.updated_at.slice(0, 10)} 동기화</span>
          {doc.commit_sha ? <span className="font-mono">{doc.commit_sha.slice(0, 7)}</span> : null}
          {source ? (
            <a
              href={source}
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              GitHub 원본 <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </header>

      <Markdown>{doc.content}</Markdown>
    </main>
  );
}
