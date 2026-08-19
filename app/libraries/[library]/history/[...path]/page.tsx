/**
 * @file app/[library]/history/[...path]/page.tsx
 * @description 문서 변경 이력. git history를 대신하는 화면이다 (D-011).
 *
 * 이력은 (레포, 경로)에 매달려 있으므로 **지워진 문서의 이력도 여기서 보인다.**
 * 되돌리기도 거기서 된다 — 삭제야말로 되돌릴 수 있어야 하는 사건이다.
 *
 * **한 라우트가 두 모드다.** `?v=<id>`가 없으면 목록, 있으면 그 버전 하나의 상세.
 * 라우트를 나누지 않은 건 `[...path]`가 catch-all이라 그 아래 정적 세그먼트를 둘 수
 * 없기 때문이다. searchParams면 서버 렌더가 유지되고 URL 공유도 된다.
 *
 * **목록은 본문을 읽지 않는다.** 예전에는 50개 버전의 `content`를 통째로 싣고 각각
 * diff까지 그렸다 — 이 레포 실측으로 버전당 평균 18KB, 48개에 886KB였다. 지금은
 * 목록이 sha·메모·작성자·시각만 읽고, 본문은 상세가 그 버전 하나(+비교 대상 하나)만
 * 가져온다.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { formatDateTime } from "@/lib/datetime";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { restoreVersion } from "@/actions/document";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DiffView } from "@/components/DiffView";
import { VersionCard, type VersionSummary } from "@/components/VersionCard";
import { getMemberLibrary, getSessionEmail, isAdmin } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

/** 한 쪽에 실을 버전 수. 본문을 안 읽으므로 넉넉해도 가볍다 */
const PAGE_SIZE = 20;

export default async function HistoryPage({
  params,
  searchParams,
}: PageProps<"/libraries/[library]/history/[...path]">) {
  const { library: slug, path } = await params;
  const docPath = path.join("/");
  const query = await searchParams;

  const email = await getSessionEmail();
  if (!email) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(`/libraries/${slug}/history/${docPath}`)}`);
  }

  const library = await getMemberLibrary(email, slug);
  if (!library) notFound();

  // 되돌리기는 소유자만 (D-021) — 목록·상세를 보는 건 멤버 전원, 그대로다.
  const isOwner = library.owner_email === email || (await isAdmin());

  const basePath = `/libraries/${library.slug}/history/${docPath}`;

  const selected = versionId(query.v);

  return selected !== null ? (
    <VersionDetail
      libraryId={library.id}
      slug={library.slug}
      docPath={docPath}
      basePath={basePath}
      versionId={selected}
      isOwner={isOwner}
    />
  ) : (
    <VersionList
      libraryId={library.id}
      slug={library.slug}
      docPath={docPath}
      basePath={basePath}
      before={versionId(query.before)}
    />
  );
}

/**
 * 쿼리 문자열 → 버전 id. 아니면 null.
 *
 * `> 0`을 거르는 게 핵심이다 — `?before=`는 `Number("")`가 0이라 정수 검사를 통과하고,
 * `id < 0` 조건은 아무것도 못 찾아 "이력이 없다"로 보인다.
 */
function versionId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string") return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

interface ViewProps {
  libraryId: string;
  slug: string;
  docPath: string;
  basePath: string;
}

/** 목록 — 본문을 읽지 않는다 */
async function VersionList({ libraryId, slug, docPath, basePath, before }: ViewProps & { before: number | null }) {
  // `content`를 고르지 않는 게 이 화면 경량화의 전부다. 컬럼 하나를 되살리는 순간
  // 목록이 다시 수백 KB가 된다.
  let listQuery = supabase
    .from("document_versions")
    .select("id, content_sha, author, note, created_at")
    .eq("library_id", libraryId)
    .eq("path", docPath)
    .order("id", { ascending: false })
    // 한 개를 더 받아 "다음 쪽이 있나"를 판단한다 — count 쿼리를 따로 쏘지 않는다
    .limit(PAGE_SIZE + 1);
  if (before !== null) listQuery = listQuery.lt("id", before);

  const [history, current] = await Promise.all([
    listQuery,
    supabase
      .from("documents")
      .select("updated_at, updated_by")
      .eq("library_id", libraryId)
      .eq("path", docPath)
      .maybeSingle(),
  ]);

  if (history.error) console.error("HistoryPage: list", history.error);
  const rows: VersionSummary[] = history.data ?? [];
  const versions = rows.slice(0, PAGE_SIZE);
  const nextCursor = rows.length > PAGE_SIZE ? versions[versions.length - 1].id : null;
  const live = current.data;

  return (
    <PageShell className="space-y-6">
      <PageHeader
        breadcrumb={<Breadcrumb slug={slug} docPath={docPath} live={!!live} />}
        title="변경 이력"
        description={
          live
            ? `현재 ${formatDateTime(live.updated_at)}${live.updated_by ? ` · ${live.updated_by}` : ""}`
            : "이 문서는 삭제됐어요. 아래에서 되돌릴 수 있어요."
        }
      />

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {before === null
            ? "아직 이력이 없어요. 처음 저장된 뒤 한 번도 바뀌지 않았다는 뜻이에요."
            : "이 뒤로는 더 없어요."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {versions.map((version) => (
            <li key={version.id}>
              <VersionCard version={version} href={`${basePath}?v=${version.id}`} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-between text-sm">
        {before !== null ? (
          <Link href={basePath} className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
            처음으로
          </Link>
        ) : (
          <span />
        )}
        {nextCursor !== null ? (
          <Link
            href={`${basePath}?before=${nextCursor}`}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            이전 기록 더보기
          </Link>
        ) : null}
      </div>

      {/* 되돌리기는 덮어쓰기가 아니라 새 저장이다 — 그 사실이 화면에도 보여야 한다 */}
      <p className="border-t pt-4 text-xs text-muted-foreground">
        되돌려도 지워지지 않아요. 현재 내용을 이력에 남기고 그 위에 새로 써요.
      </p>
    </PageShell>
  );
}

/** 상세 — 이 버전 하나와 비교 대상 하나만 읽는다 */
async function VersionDetail({
  libraryId,
  slug,
  docPath,
  basePath,
  versionId,
  isOwner,
}: ViewProps & { versionId: number; isOwner: boolean }) {
  // library_id·path까지 걸어야 남의 이력을 id만으로 끌어올 수 없다 (restoreVersion과 같은 방어)
  const { data: version, error } = await supabase
    .from("document_versions")
    .select("id, content, content_sha, author, note, created_at")
    .eq("id", versionId)
    .eq("library_id", libraryId)
    .eq("path", docPath)
    .maybeSingle();

  if (error) console.error("HistoryPage: detail", error);
  if (!version) notFound();

  /**
   * `document_versions`에는 **이전 본문**이 담긴다. 그래서 이 행이 만든 결과는 바로 다음
   * 버전의 본문이고, 다음 버전이 없으면 현재 문서다. 삭제된 문서면 빈 문자열 —
   * 전면 삭제로 보이는 게 맞다.
   */
  const [next, current] = await Promise.all([
    supabase
      .from("document_versions")
      .select("content")
      .eq("library_id", libraryId)
      .eq("path", docPath)
      .gt("id", versionId)
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("content")
      .eq("library_id", libraryId)
      .eq("path", docPath)
      .maybeSingle(),
  ]);

  const after = next.data?.content ?? current.data?.content ?? "";

  return (
    <PageShell className="space-y-6">
      <PageHeader
        breadcrumb={<Breadcrumb slug={slug} docPath={docPath} live={!!current.data} />}
        title={<span className="font-mono">{version.content_sha.slice(0, 8)}</span>}
        description={
          <>
            <span className="block">
              {formatDateTime(version.created_at)} · {version.author}
            </span>
            {version.note ? <span className="mt-1 block">{version.note}</span> : null}
          </>
        }
        action={
          isOwner ? (
            <ConfirmDialog
              trigger="이 버전으로 되돌리기"
              title="이 버전으로 되돌릴까요?"
              confirmLabel="되돌리기"
              description={
                <>
                  <span className="block font-mono text-xs">
                    {formatDateTime(version.created_at)} · {version.author}
                  </span>
                  {version.note ? (
                    <span className="mt-1 block">&ldquo;{version.note}&rdquo;</span>
                  ) : null}
                  <span className="mt-2 block">
                    되돌려도 지워지지 않아요 — 지금 내용을 이력에 남기고 그 위에 새로 써요.
                  </span>
                </>
              }
              triggerSize="sm"
              formId={`restore-${version.id}`}
            >
              <form id={`restore-${version.id}`} action={restoreVersion}>
                <input type="hidden" name="library" value={slug} />
                <input type="hidden" name="path" value={docPath} />
                <input type="hidden" name="version_id" value={version.id} />
              </form>
            </ConfirmDialog>
          ) : undefined
        }
      />

      <Link
        href={basePath}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> 이력 목록
      </Link>

      <div className="rounded-lg border">
        <DiffView before={version.content} after={after} />
      </div>

      {/* diff가 상한에 걸려 생략될 때 전문이 유일한 수단이다 — 그래서 남겨 둔다 */}
      <details className="rounded-lg border">
        <summary className="cursor-pointer px-3 py-2 text-xs text-muted-foreground">
          이때의 전문 보기 ({version.content.split("\n").length}줄)
        </summary>
        <pre className="max-h-96 overflow-auto border-t px-3 py-2 font-mono text-xs leading-relaxed">
          {version.content}
        </pre>
      </details>
    </PageShell>
  );
}

function Breadcrumb({ slug, docPath, live }: { slug: string; docPath: string; live: boolean }) {
  return (
    <>
      <Link href={`/libraries/${slug}`} className="font-mono hover:text-foreground">
        {slug}
      </Link>
      {" / "}
      {live ? (
        <Link href={`/libraries/${slug}/${docPath}`} className="font-mono hover:text-foreground">
          {docPath}
        </Link>
      ) : (
        <span className="font-mono">{docPath}</span>
      )}
    </>
  );
}
