/**
 * @file app/libraries/[library]/page.tsx
 * @description 문서 목록 + 최근 변경 타임라인.
 *
 * 타임라인은 `sync_events.summary`를 그대로 보여준다 — 알림·에이전트 델타와 같은 문자열이다.
 * 두 번 만들면 두 번 드리프트한다 (SPEC §8).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { formatDate } from "@/lib/datetime";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { ChangeCard, type ChangeEvent } from "@/components/ChangeCard";
import { LibrarySettingsDialog } from "@/components/LibrarySettingsDialog";
import { MembersDialog } from "@/components/MembersDialog";
import { getReadableLibrary, getSessionEmail, isAdmin, isPublic } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

interface DocRow {
  path: string;
  title: string | null;
  updated_at: string;
}

/** 링크를 아는 사람만 보는 것이지 검색으로 찾는 것이 아니다 (D-024). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LibraryPage({ params }: PageProps<"/libraries/[library]">) {
  const { library: slug } = await params;

  const email = await getSessionEmail();
  // 공개 라이브러리는 비로그인도 문서 목록·본문까지 본다 (D-024).
  const view = await getReadableLibrary(email, slug);
  if (!view) {
    // 비로그인이면 로그인부터 — 로그인하면 보이는 라이브러리일 수 있다.
    // 로그인했는데도 못 보면 404다. 403은 "그 라이브러리가 존재한다"를 알려준다 (SPEC §6).
    if (!email) redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/libraries/${slug}`)}`);
    notFound();
  }
  const { library, isMember } = view;

  // 멤버 관리·설정 변경은 소유자만 (D-021). admin은 여기서도 예외다.
  const isOwner = isMember && (library.owner_email === email || (await isAdmin()));

  const [docs, events, memberRows, inviteRows] = await Promise.all([
    supabase
      .from("documents")
      // 목록에 필요한 것만 읽는다. 본문은 문서 보기 화면이 그 문서 하나만 가져온다.
      .select("path, title, updated_at")
      .eq("library_id", library.id)
      .order("path"),
    // 변경 타임라인·멤버 목록은 편집자 이메일과 팀 명단이라 멤버에게만 (D-024).
    isMember
      ? supabase
          .from("sync_events")
          .select("id, summary, author, created_at, changed_paths, deleted_paths")
          .eq("library_id", library.id)
          .order("id", { ascending: false })
          // 최신 1건만 보여준다. 2건을 읽는 건 "더보기"를 걸지 말지 알기 위해서다.
          .limit(2)
      : Promise.resolve({ data: null, error: null }),
    isMember
      ? supabase.from("library_members").select("email").eq("library_id", library.id).order("email")
      : Promise.resolve({ data: null, error: null }),
    // 초대 다이얼로그는 소유자만 본다 — 아니면 쿼리 자체가 낭비다 (D-023).
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
            {/* 알림 채널은 내부 설정이라 멤버에게만 (D-024) */}
            {isMember ? (
              <>
                {" · "}
                {/* 붙어 있으면 어디에 붙었는지 보여준다 — 없을 때만 알리면 확인할 방법이 없다 */}
                {[
                  library.mattermost_webhook_url ? "Mattermost" : null,
                  library.discord_webhook_url ? "Discord" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "알림 채널 없음"}
              </>
            ) : null}
          </>
        }
        action={
          <div className="flex shrink-0 items-center gap-2">
            {/* 보는 것과 관리하는 것의 권한 문턱이 다르다 (D-021) — 목록은 멤버 전원,
                초대·제거·설정은 소유자(또는 admin)만. 다이얼로그 안에서 갈린다.
                비멤버(공개 열람자)에게는 멤버 목록 자체가 안 보인다 (D-024) */}
            {isMember && email && (
              <MembersDialog
                libraryId={library.id}
                librarySlug={library.slug}
                members={members}
                currentEmail={email}
                isOwner={isOwner}
                hasActiveInvite={hasActiveInvite}
              />
            )}
            {isOwner && (
              <LibrarySettingsDialog
                libraryId={library.id}
                name={library.name}
                githubRepos={library.github_repos}
                mattermostWebhookUrl={library.mattermost_webhook_url}
                discordWebhookUrl={library.discord_webhook_url}
                isPublic={isPublic(library)}
              />
            )}
          </div>
        }
      />

      {/* 위에서부터 최근 변경 → 문서. 무슨 일이 있었나 → 무엇이 있나 순이다.
          멤버는 헤더의 다이얼로그로 옮겼다.
          공개 열람자에게는 문서 목록만 남는다 — 나머지는 편집자 이메일이다 (D-024). */}
      {isMember && (
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
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium">문서</h2>
          {isMember && (
            <Link
              href={`/libraries/${library.slug}/new`}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              새 문서
            </Link>
          )}
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isMember ? (
              <>
                아직 문서가 없어요. 위에 있는 &quot;새 문서&quot;로 직접 만들거나, 에이전트가{" "}
                <code>doc_put</code>으로 만들 수 있어요.
              </>
            ) : (
              "아직 문서가 없어요."
            )}
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
    </PageShell>
  );
}
