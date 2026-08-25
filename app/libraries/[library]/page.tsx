/**
 * @file app/libraries/[library]/page.tsx
 * @description 문서 목록 + 최근 변경 타임라인 + 예측 절약 (T-501).
 *
 * 타임라인은 `sync_events.summary`를 그대로 보여준다 — 알림·에이전트 델타와 같은 문자열이다.
 * 두 번 만들면 두 번 드리프트한다 (SPEC §8).
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatDate } from "@/lib/datetime";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { ChangeCard, type ChangeEvent } from "@/components/ChangeCard";
import { LibrarySettingsDialog } from "@/components/LibrarySettingsDialog";
import { MembersDialog } from "@/components/MembersDialog";
import { getMemberLibrary, getSessionEmail, isAdmin } from "@/lib/authz";
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
  const library = await getMemberLibrary(email, slug);
  if (!library) notFound();

  // 멤버 관리·설정 변경은 소유자만 (D-021). admin은 여기서도 예외다.
  const isOwner = library.owner_email === email || (await isAdmin());

  const [docs, events, memberRows, inviteRows] = await Promise.all([
    supabase
      .from("documents")
      // ponytail: 절약 추정 때문에 본문까지 읽는다. 레포 하나에 문서 수십 개면 충분하고,
      // 무거워지면 documents에 문자수 컬럼을 비정규화한다.
      .select("path, title, updated_at, content")
      .eq("library_id", library.id)
      .order("path"),
    supabase
      .from("sync_events")
      .select("id, summary, author, created_at, changed_paths, deleted_paths")
      .eq("library_id", library.id)
      .order("id", { ascending: false })
      // 최신 1건만 보여준다. 2건을 읽는 건 "더보기"를 걸지 말지 알기 위해서다.
      .limit(2),
    supabase
      .from("library_members")
      .select("email")
      .eq("library_id", library.id)
      .order("email"),
    // 초대 다이얼로그는 소유자만 본다 — 아니면 쿼리 자체가 낭비다 (D-022).
    isOwner
      ? supabase
          .from("library_invites")
          .select("id")
          .eq("library_id", library.id)
          .is("revoked_at", null)
          .limit(1)
      : Promise.resolve({ data: null, error: null }),
  ]);
  const members: { email: string }[] = memberRows.data ?? [];
  const hasActiveInvite = (inviteRows.data?.length ?? 0) > 0;

  if (docs.error) console.error("LibraryPage: documents", docs.error);
  if (events.error) console.error("LibraryPage: events", events.error);

  const documents: DocRow[] = docs.data ?? [];
  const timeline: ChangeEvent[] = events.data ?? [];
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
          <div className="flex shrink-0 items-center gap-2">
            {/* 보는 것과 관리하는 것의 권한 문턱이 다르다 (D-021) — 목록은 멤버 전원,
                초대·제거·설정은 소유자(또는 admin)만. 다이얼로그 안에서 갈린다 */}
            <MembersDialog
              libraryId={library.id}
              librarySlug={library.slug}
              members={members}
              currentEmail={email}
              isOwner={isOwner}
              hasActiveInvite={hasActiveInvite}
            />
            {isOwner && (
              <LibrarySettingsDialog
                libraryId={library.id}
                name={library.name}
                githubRepos={library.github_repos}
                mattermostWebhookUrl={library.mattermost_webhook_url}
                discordWebhookUrl={library.discord_webhook_url}
              />
            )}
          </div>
        }
      />

      {/* 위에서부터 최근 변경 → 문서 → 토큰 사용량. 무슨 일이 있었나 → 무엇이 있나 →
          얼마나 썼나 순이다. 멤버는 헤더의 다이얼로그로 옮겼다. */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">최근 변경</h2>
          {timeline.length > 0 ? (
            <Link
              href={`/libraries/${library.slug}/changes`}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              더보기
            </Link>
          ) : null}
        </div>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 변경 기록이 없어요.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {/* 최신 하나만. 나머지는 더보기로 간다 */}
            <li>
              <ChangeCard event={timeline[0]} librarySlug={library.slug} />
            </li>
          </ul>
        )}
      </section>

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
            아직 문서가 없어요. 위의 &quot;새 문서&quot;로 만들거나, 에이전트가{" "}
            <code>doc_put</code>으로 만들 수 있어요.
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
                    {formatDate(doc.updated_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 이 도구가 존재하는 이유를 그 라이브러리의 숫자로 보여준다. 실측(그래프)과
          추정(절약)을 한 카드에 두되 역할을 나눈다 — 자세한 건 UsageChart 주석에. */}
      <UsageChart
        summary={usage}
        range={range}
        savings={savings}
        documentCount={documents.length}
        basePath={`/libraries/${library.slug}`}
      />

    </PageShell>
  );
}
