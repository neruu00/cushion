/**
 * @file app/[repo]/history/[...path]/page.tsx
 * @description 문서 변경 이력. git history를 대신하는 화면이다 (D-011).
 *
 * 이력은 (레포, 경로)에 매달려 있으므로 **지워진 문서의 이력도 여기서 보인다.**
 * 되돌리기도 거기서 된다 — 삭제야말로 되돌릴 수 있어야 하는 사건이다.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { restoreVersion } from "@/actions/document";
import { DiffView } from "@/components/DiffView";
import { Button } from "@/components/ui/button";
import { getAccessibleRepo, getSessionEmail } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

interface VersionRow {
  id: number;
  content: string;
  content_sha: string;
  author: string;
  note: string | null;
  created_at: string;
}

export default async function HistoryPage({ params }: PageProps<"/repositories/[repo]/history/[...path]">) {
  const { repo: slug, path } = await params;
  const docPath = path.join("/");

  const email = await getSessionEmail();
  if (!email) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/repositories/${slug}/history/${docPath}`)}`);
  }

  const repo = await getAccessibleRepo(email, slug);
  if (!repo) notFound();

  const [history, current] = await Promise.all([
    supabase
      .from("document_versions")
      .select("id, content, content_sha, author, note, created_at")
      .eq("repository_id", repo.id)
      .eq("path", docPath)
      .order("id", { ascending: false })
      .limit(50),
    supabase
      .from("documents")
      .select("content, content_sha, updated_at, updated_by")
      .eq("repository_id", repo.id)
      .eq("path", docPath)
      .maybeSingle(),
  ]);

  if (history.error) console.error("HistoryPage", history.error);
  const versions: VersionRow[] = history.data ?? [];
  const live = current.data;

  /**
   * `document_versions`에는 **이전 본문**이 담긴다. 그래서 i번째 행이 만든 결과는
   * 한 칸 앞 버전이고, 가장 최근 변경의 결과는 현재 문서다.
   * 삭제된 문서면 결과가 빈 문자열 — 전면 삭제로 보이는 게 맞다.
   */
  const resultOf = (index: number) =>
    index === 0 ? (live?.content ?? "") : versions[index - 1].content;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href={`/repositories/${repo.slug}`} className="font-mono hover:text-foreground">
            {repo.slug}
          </Link>
          {" / "}
          {live ? (
            <Link href={`/repositories/${repo.slug}/${docPath}`} className="font-mono hover:text-foreground">
              {docPath}
            </Link>
          ) : (
            <span className="font-mono">{docPath}</span>
          )}
        </p>
        <h1 className="text-xl font-semibold">변경 이력</h1>
        <p className="text-sm text-muted-foreground">
          {live
            ? `현재 ${live.updated_at.slice(0, 19)}${live.updated_by ? ` · ${live.updated_by}` : ""}`
            : "이 문서는 삭제됐다. 아래에서 되돌릴 수 있다."}
        </p>
      </header>

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          아직 이력이 없다. 처음 저장된 뒤 한 번도 안 바뀌었다는 뜻이다.
        </p>
      ) : (
        <ul className="space-y-3">
          {versions.map((version, index) => (
            <li key={version.id} className="rounded-lg border">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
                <span className="min-w-0 text-sm">
                  <span className="text-muted-foreground">
                    {version.created_at.slice(0, 19)} · {version.author}
                  </span>
                  {version.note ? <span className="block truncate">{version.note}</span> : null}
                </span>
                <form action={restoreVersion}>
                  <input type="hidden" name="repo" value={repo.slug} />
                  <input type="hidden" name="path" value={docPath} />
                  <input type="hidden" name="version_id" value={version.id} />
                  <Button type="submit" variant="outline" size="xs">
                    이 버전으로 되돌리기
                  </Button>
                </form>
              </div>
              <DiffView before={version.content} after={resultOf(index)} />

              <details className="border-t">
                <summary className="cursor-pointer px-3 py-1.5 text-xs text-muted-foreground">
                  이때의 전문 보기 ({version.content.split("\n").length}줄)
                </summary>
                <pre className="max-h-96 overflow-auto px-3 pb-3 font-mono text-xs leading-relaxed">
                  {version.content}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}

      {/* 되돌리기는 덮어쓰기가 아니라 새 저장이다 — 그 사실이 화면에도 보여야 한다 */}
      <p className="border-t pt-4 text-xs text-muted-foreground">
        되돌리기는 지우지 않는다. 현재 내용을 이력에 남기고 그 위에 새로 쓴다.
      </p>
    </main>
  );
}
