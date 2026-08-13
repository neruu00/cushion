/**
 * @file app/repositories/[repo]/page.tsx
 * @description 문서 목록 + 최근 변경 타임라인 + 예측 절약 (T-501).
 *
 * 타임라인은 `sync_events.summary`를 그대로 보여준다 — 알림·에이전트 델타와 같은 문자열이다.
 * 두 번 만들면 두 번 드리프트한다 (SPEC §8).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Trash2 } from "lucide-react";

import { addMember, removeMember } from "@/actions/repository";
import { ActionForm } from "@/components/ActionForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WebhookDialog } from "@/components/WebhookDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccessibleRepo, getSessionEmail } from "@/lib/authz";
import { estimateSavings } from "@/lib/savings";
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

export default async function RepoPage({ params }: PageProps<"/repositories/[repo]">) {
  const { repo: slug } = await params;

  const email = await getSessionEmail();
  if (!email) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/repositories/${slug}`)}`);

  // 권한이 없으면 404다. 403은 "그 레포가 존재한다"를 알려준다 (SPEC §6).
  const repo = await getAccessibleRepo(email, slug);
  if (!repo) notFound();

  const [docs, events, memberRows] = await Promise.all([
    supabase
      .from("documents")
      // ponytail: 절약 추정 때문에 본문까지 읽는다. 레포 하나에 문서 수십 개면 충분하고,
      // 무거워지면 documents에 문자수 컬럼을 비정규화한다.
      .select("path, title, updated_at, content")
      .eq("repository_id", repo.id)
      .order("path"),
    supabase
      .from("sync_events")
      .select("id, summary, created_at, changed_paths, deleted_paths")
      .eq("repository_id", repo.id)
      .order("id", { ascending: false })
      .limit(10),
    supabase
      .from("repository_members")
      .select("email")
      .eq("repository_id", repo.id)
      .order("email"),
  ]);
  const members: { email: string }[] = memberRows.data ?? [];

  if (docs.error) console.error("RepoPage: documents", docs.error);
  if (events.error) console.error("RepoPage: events", events.error);

  const documents: DocRow[] = docs.data ?? [];
  const timeline: EventRow[] = events.data ?? [];
  const savings = estimateSavings(documents);
  const fmt = (n: number) => n.toLocaleString();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
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
            {" · "}
            {/* 붙어 있으면 어디에 붙었는지 보여준다 — 없을 때만 알리면 확인할 방법이 없다 */}
            {[
              repo.mattermost_webhook_url ? "Mattermost" : null,
              repo.discord_webhook_url ? "Discord" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "알림 채널 없음"}
          </p>
        </div>
        <WebhookDialog
          repositoryId={repo.id}
          mattermostWebhookUrl={repo.mattermost_webhook_url}
          discordWebhookUrl={repo.discord_webhook_url}
        />
      </header>

      {/* 이 도구가 존재하는 이유를 그 레포의 숫자로 보여준다. 추정이라고 명시한다. */}
      {savings && savings.savedTokens > 0 ? (
        <section className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p>
            에이전트가 이 레포의 문서를 전부 읽으면 <strong>~{fmt(savings.controlTokens)} tok</strong>.
            목차 1회 + 작업당 섹션 1개면 <strong>~{fmt(savings.outlineTokens + savings.perTaskTokens)} tok</strong> —
            세션당 <strong>~{fmt(savings.savedTokens)} tok</strong> 아낀다.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            추정 · {savings.ratio.toFixed(1)}배 · 문서 {documents.length}개 기준. 목차는 세션당
            한 번이라 작업이 늘수록 더 벌어진다.
          </p>
        </section>
      ) : null}

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

      {/* 이 페이지 자체가 멤버만 보므로, 멤버 관리의 권한 문턱과 정확히 일치한다 (D-013) */}
      <section className="space-y-2 border-t pt-6">
        <h2 className="text-sm font-medium">멤버</h2>
        <p className="text-sm text-muted-foreground">
          멤버는 이 레포의 문서를 읽고 쓸 수 있고, 다른 멤버를 초대할 수 있다.
          자기 자신을 지우면 나가기다 — 마지막 멤버가 나가면 아무도 못 보게 된다.
        </p>
        <ul className="divide-y rounded-lg border">
          {members.map((member) => (
            <li key={member.email} className="flex items-center justify-between gap-2 px-3 py-1.5">
              <span className="truncate font-mono text-sm">
                {member.email}
                {member.email === email ? " (나)" : ""}
              </span>
              <form action={removeMember}>
                <input type="hidden" name="repository_id" value={repo.id} />
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
          <input type="hidden" name="repository_id" value={repo.id} />
          <Label className="grid gap-1.5">
            <span>이메일</span>
            <Input name="email" type="email" placeholder="teammate@example.com" required />
          </Label>
        </ActionForm>
      </section>
    </main>
  );
}
