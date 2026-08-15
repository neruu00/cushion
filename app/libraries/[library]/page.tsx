/**
 * @file app/libraries/[library]/page.tsx
 * @description 문서 목록 + 최근 변경 타임라인 + 예측 절약 (T-501).
 *
 * 타임라인은 `sync_events.summary`를 그대로 보여준다 — 알림·에이전트 델타와 같은 문자열이다.
 * 두 번 만들면 두 번 드리프트한다 (SPEC §8).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Trash2 } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { addMember, removeMember } from "@/actions/library";
import { ActionForm } from "@/components/ActionForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LibrarySettingsDialog } from "@/components/LibrarySettingsDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccessibleLibrary, getSessionEmail } from "@/lib/authz";
import { UsageChart } from "@/components/UsageChart";
import { estimateSavings } from "@/lib/savings";
import { parseRange } from "@/lib/usage";
import { getUsage } from "@/lib/usage.db";
import { supabase } from "@/lib/supabase";

interface DocRow {
  path: string;
  title: string | null;
  updated_at: string;
  content: string;
}

interface EventRow {
  id: number;
  summary: string | null;
  created_at: string;
  changed_paths: string[] | null;
  deleted_paths: string[] | null;
}

export default async function LibraryPage({
  params,
  searchParams,
}: PageProps<"/libraries/[library]">) {
  const { library: slug } = await params;
  // Next 16은 searchParams도 await다 (동기 접근 제거)
  const range = parseRange((await searchParams).range);

  const email = await getSessionEmail();
  if (!email) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/libraries/${slug}`)}`);

  // 권한이 없으면 404다. 403은 "그 레포가 존재한다"를 알려준다 (SPEC §6).
  const library = await getAccessibleLibrary(email, slug);
  if (!library) notFound();

  const [docs, events, memberRows] = await Promise.all([
    supabase
      .from("documents")
      // ponytail: 절약 추정 때문에 본문까지 읽는다. 레포 하나에 문서 수십 개면 충분하고,
      // 무거워지면 documents에 문자수 컬럼을 비정규화한다.
      .select("path, title, updated_at, content")
      .eq("library_id", library.id)
      .order("path"),
    supabase
      .from("sync_events")
      .select("id, summary, created_at, changed_paths, deleted_paths")
      .eq("library_id", library.id)
      .order("id", { ascending: false })
      .limit(10),
    supabase
      .from("library_members")
      .select("email")
      .eq("library_id", library.id)
      .order("email"),
  ]);
  const members: { email: string }[] = memberRows.data ?? [];

  if (docs.error) console.error("LibraryPage: documents", docs.error);
  if (events.error) console.error("LibraryPage: events", events.error);

  const documents: DocRow[] = docs.data ?? [];
  const timeline: EventRow[] = events.data ?? [];
  const savings = estimateSavings(documents);
  const usage = await getUsage(library.id, range);

  return (
    <PageShell className="space-y-8">
      <PageHeader
        title={<span className="font-mono">{library.slug}</span>}
        description={
          <>
            {library.name}
            {library.github_repos.length > 0 ? (
              <>
                {" · "}
                {library.github_repos.map((full, i) => (
                  <span key={full}>
                    {i > 0 ? ", " : ""}
                    {full.endsWith("/*") ? (
                      full
                    ) : (
                      <a
                        href={`https://github.com/${full}`}
                        className="underline underline-offset-4"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {full}
                      </a>
                    )}
                  </span>
                ))}
              </>
            ) : null}
            {" · "}
            {/* 붙어 있으면 어디에 붙었는지 보여준다 — 없을 때만 알리면 확인할 방법이 없다 */}
            {[
              library.mattermost_webhook_url ? "Mattermost" : null,
              library.discord_webhook_url ? "Discord" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "알림 채널 없음"}
          </>
        }
        action={
          <LibrarySettingsDialog
          libraryId={library.id}
          name={library.name}
          githubRepos={library.github_repos}
          mattermostWebhookUrl={library.mattermost_webhook_url}
          discordWebhookUrl={library.discord_webhook_url}
        />
        }
      />

      {/* 이 도구가 존재하는 이유를 그 라이브러리의 숫자로 보여준다. 실측(그래프)과
          추정(절약)을 한 카드에 두되 역할을 나눈다 — 자세한 건 UsageChart 주석에. */}
      <UsageChart
        summary={usage}
        range={range}
        savings={savings}
        documentCount={documents.length}
        basePath={`/libraries/${library.slug}`}
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">문서</h2>
          <Link
            href={`/libraries/${library.slug}/new`}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            새 문서
          </Link>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            아직 문서가 없어요. 위의 &quot;새 문서&quot;로 만들거나, 에이전트가 <code>doc_put</code>으로 만들 수 있어요.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {documents.map((doc) => (
              <li key={doc.path}>
                <Link
                  href={`/libraries/${library.slug}/${doc.path}`}
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
          <p className="text-sm text-muted-foreground">아직 변경 기록이 없어요.</p>
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
                            href={`/libraries/${library.slug}/history/${path}`}
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

      {/* 이 페이지 자체가 멤버만 보므로, 멤버 관리의 권한 문턱과 정확히 일치한다 (D-013) */}
      <section className="space-y-2 border-t pt-6">
        <h2 className="text-sm font-medium">멤버</h2>
        <p className="text-sm text-muted-foreground">
          멤버는 이 라이브러리의 문서를 읽고 쓸 수 있고, 다른 멤버를 초대할 수 있어요.
          자기 자신을 지우면 나가는 거예요 — 마지막 멤버가 나가면 아무도 볼 수 없게 돼요.
        </p>
        <ul className="divide-y rounded-lg border">
          {members.map((member) => (
            <li key={member.email} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="truncate font-mono text-sm">
                {member.email}
                {member.email === email ? " (나)" : ""}
              </span>
              <form action={removeMember}>
                <input type="hidden" name="library_id" value={library.id} />
                <input type="hidden" name="email" value={member.email} />
                <Button
                  type="submit"
                  variant="destructive"
                  size="xs"
                  aria-label={`${member.email} 제거`}
                >
                  <Trash2 />
                </Button>
              </form>
            </li>
          ))}
        </ul>
        <ActionForm action={addMember} submitLabel="초대">
          <input type="hidden" name="library_id" value={library.id} />
          <Label className="grid gap-1.5">
            <span>이메일</span>
            <Input name="email" type="email" placeholder="teammate@example.com" required />
          </Label>
        </ActionForm>
      </section>
    </PageShell>
  );
}
