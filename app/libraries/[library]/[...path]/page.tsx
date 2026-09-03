/**
 * @file app/[library]/[...path]/page.tsx
 * @description 문서 보기 (T-502).
 *
 * 원본이 여기 있으므로 편집 링크가 있다 (D-011). GitHub 링크는 문서가 아니라
 * "관련 코드 레포"를 가리킨다 — 문서는 더 이상 그 레포에 없다.
 *
 * 공개 라이브러리는 **비로그인도 본문을 읽는다** (D-024). 편집·이력 링크는 멤버에게만
 * 보인다 — 비멤버가 눌러 봐야 그 라우트들이 다시 막는다(여기 숨기는 건 UX다).
 */
import { ExternalLink, History, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatDate } from "@/lib/datetime";
import { PageShell } from "@/components/PageShell";
import { Markdown } from "@/components/Markdown";
import { getReadableLibrary, getSessionEmail } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

/** 링크를 아는 사람만 보는 것이지 검색으로 찾는 것이 아니다 (D-024). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DocumentPage({ params }: PageProps<"/libraries/[library]/[...path]">) {
  const { library: slug, path } = await params;
  const docPath = path.join("/");

  const email = await getSessionEmail();
  const view = await getReadableLibrary(email, slug);

  // 비로그인이면 로그인부터 — 로그인하면 보이는 라이브러리일 수 있다.
  // 로그인했는데도 못 보면 그때는 404다(존재를 알려주지 않는다).
  if (!view) {
    if (!email) {
      redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/libraries/${slug}/${docPath}`)}`);
    }
    notFound();
  }
  const { library, isMember } = view;

  const { data: doc, error } = await supabase
    .from("documents")
    .select("path, title, content, updated_at, updated_by")
    .eq("library_id", library.id)
    .eq("path", docPath)
    .maybeSingle();

  if (error) console.error("DocumentPage", error);
  if (!doc) notFound();

  // 문서는 여기 있고 레포는 관련 코드일 뿐이다 — 문서 파일이 아니라 레포로 건다.
  // 여러 레포가 이 라이브러리를 볼 수 있다. 첫 항목만 건다 — 와일드카드(org/*)는 링크가 안 된다.
  const linkable = library.github_repos.find((name) => !name.endsWith("/*"));
  const source = linkable ? `https://github.com/${linkable}` : null;

  return (
    <PageShell className="space-y-6">
      <header className="space-y-2 border-b pb-4">
        <p className="text-xs text-muted-foreground">
          <Link href={`/libraries/${library.slug}`} className="font-mono hover:text-foreground">
            {library.slug}
          </Link>
          {" / "}
          <span className="font-mono">{doc.path}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {/* 편집자 이메일은 멤버에게만 — 공개 문서에서 팀 명단이 새면 안 된다 (D-024) */}
          <span>
            {formatDate(doc.updated_at)}
            {isMember && doc.updated_by ? ` · ${doc.updated_by}` : ""}
          </span>
          {isMember && (
            <>
              <Link
                href={`/libraries/${library.slug}/edit/${doc.path}`}
                className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
              >
                편집 <Pencil className="size-3" />
              </Link>
              <Link
                href={`/libraries/${library.slug}/history/${doc.path}`}
                className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
              >
                이력 <History className="size-3" />
              </Link>
            </>
          )}
          {source ? (
            <a
              href={source}
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
              target="_blank"
              rel="noreferrer"
            >
              관련 GitHub 레포 <ExternalLink className="size-3" />
            </a>
          ) : null}
        </div>
      </header>

      <Markdown>{doc.content}</Markdown>
    </PageShell>
  );
}
