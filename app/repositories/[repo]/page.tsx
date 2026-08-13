/**
 * @file app/[repo]/page.tsx
 * @description 문서 목록 + 최근 변경 타임라인 (T-501).
 *
 * 타임라인은 `sync_events.summary`를 그대로 보여준다 — 알림·에이전트 델타와 같은 문자열이다.
 * 두 번 만들면 두 번 드리프트한다 (SPEC §8).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessibleRepo, getSessionEmail } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

interface DocRow {
  path: string;
  title: string | null;
  updated_at: string;
}

interface EventRow {
  id: number;
  summary: string | null;
  created_at: string;
  changed_paths: string[] | null;
  deleted_paths: string[] | null;
}

export default async function RepoPage({ params }: PageProps<"/repositories/[repo]">) {
  const { repo: slug } = await params;

  const email = await getSessionEmail();
  if (!email) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/repositories/${slug}`)}`);

  // 권한이 없으면 404다. 403은 "그 레포가 존재한다"를 알려준다 (SPEC §6).
  const repo = await getAccessibleRepo(email, slug);
  if (!repo) notFound();

  const [docs, events] = await Promise.all([
    supabase
      .from("documents")
      .select("path, title, updated_at")
      .eq("repository_id", repo.id)
      .order("path"),
    supabase
      .from("sync_events")
      .select("id, summary, created_at, changed_paths, deleted_paths")
      .eq("repository_id", repo.id)
      .order("id", { ascending: false })
      .limit(10),
  ]);

  if (docs.error) console.error("RepoPage: documents", docs.error);
  if (events.error) console.error("RepoPage: events", events.error);

  const documents: DocRow[] = docs.data ?? [];
  const timeline: EventRow[] = events.data ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <header className="space-y-1">
        <h1 className="font-mono text-xl font-semibold">{repo.slug}</h1>
        <p className="text-sm text-muted-foreground">
          {repo.name}
          {repo.github_full_name ? (
            <>
              {" · "}
              <a
                href={`https://github.com/${repo.github_full_name}`}
                className="underline underline-offset-4"
                target="_blank"
                rel="noreferrer"
              >
                {repo.github_full_name}
              </a>
            </>
          ) : null}
        </p>
      </header>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">문서</h2>
          <Link
            href={`/repositories/${repo.slug}/new`}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            새 문서
          </Link>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 문서가 없다. 위의 &quot;새 문서&quot;로 만들거나, 에이전트가 <code>spec_put</code>으로 만든다.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {documents.map((doc) => (
              <li key={doc.path}>
                <Link
                  href={`/repositories/${repo.slug}/${doc.path}`}
                  className="flex items-center justify-between gap-4 px-3 py-2 hover:bg-muted/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-sm">{doc.path}</span>
                    {doc.title ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {doc.title}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {doc.updated_at.slice(0, 10)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">최근 변경</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">기록 없음.</p>
        ) : (
          <ul className="space-y-3">
            {timeline.map((event) => (
              <li key={event.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xs font-normal text-muted-foreground">
                      {event.created_at.slice(0, 10)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm whitespace-pre-line">{event.summary ?? "요약 없음"}</p>
                    {/* 요약만 보이고 상세로 갈 길이 없으면 "뭐가 바뀌었나"를 못 본다 */}
                    <p className="flex flex-wrap gap-3 text-xs">
                      {[...(event.changed_paths ?? []), ...(event.deleted_paths ?? [])].map(
                        (path) => (
                          <Link
                            key={path}
                            href={`/repositories/${repo.slug}/history/${path}`}
                            className="font-mono text-muted-foreground underline underline-offset-4 hover:text-foreground"
                          >
                            {path} 변경 내역
                          </Link>
                        ),
                      )}
                    </p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

    </main>
  );
}
