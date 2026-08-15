/**
 * @file app/libraries/[library]/changes/page.tsx
 * @description 변경 목록 전체. 라이브러리 화면은 최신 하나만 보여주고 나머지는 여기다.
 *
 * 카드는 라이브러리 화면과 **같은 컴포넌트**를 쓴다(`ChangeCard`). 두 벌로 만들면
 * 한쪽만 고치는 날이 온다.
 *
 * 최근 100건까지만 낸다. 페이지네이션을 붙이지 않는 이유: 이력의 진짜 소비자는
 * 문서별 이력 화면(`history/[...path]`)이고, 여기는 "최근에 무슨 일이 있었나"를 훑는
 * 자리다. 100건을 넘겨 뒤져야 할 일이 실제로 생기면 그때 붙인다.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ChangeCard, type ChangeEvent } from "@/components/ChangeCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getAccessibleLibrary, getSessionEmail } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

const LIMIT = 100;

export default async function ChangesPage({ params }: PageProps<"/libraries/[library]/changes">) {
  const { library: slug } = await params;

  const email = await getSessionEmail();
  if (!email) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/libraries/${slug}/changes`)}`);
  }

  // 권한이 없으면 404다. 403은 "그 라이브러리가 존재한다"를 알려준다 (SPEC §6).
  const library = await getAccessibleLibrary(email, slug);
  if (!library) notFound();

  const { data, error } = await supabase
    .from("sync_events")
    .select("id, summary, author, created_at, changed_paths, deleted_paths")
    .eq("library_id", library.id)
    .order("id", { ascending: false })
    .limit(LIMIT);

  if (error) console.error("ChangesPage: events", error);
  const events: ChangeEvent[] = data ?? [];

  return (
    <PageShell className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link href={`/libraries/${library.slug}`} className="font-mono hover:text-foreground">
            {library.slug}
          </Link>
        }
        title="변경 내역"
        description={
          events.length === LIMIT ? `최근 ${LIMIT}건` : `${events.length}건`
        }
      />

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 변경 기록이 없어요.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {events.map((event) => (
            <li key={event.id}>
              <ChangeCard event={event} librarySlug={library.slug} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
