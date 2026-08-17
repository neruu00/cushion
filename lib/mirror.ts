/**
 * @file lib/mirror.ts
 * @description 편집 한 번이 남기는 흔적 — 이력 · 델타 이벤트 · 알림.
 *
 * 세 곳(웹 편집 화면, MCP 쓰기 툴, 삭제)이 같은 뒷정리를 해야 한다. 한 군데라도 빠지면
 * 이력이 비거나, 에이전트가 변경을 못 보거나(`[stale]`이 안 뜬다), 팀이 알림을 못 받는다.
 * 그래서 쓰기 경로는 전부 여기를 지난다.
 */
import { buildNotification, type PendingEvent } from "@/lib/notification";
import { summarizeEdit, type DocumentEdit } from "@/lib/summary";
import { supabase } from "@/lib/supabase";
import { baseUrl } from "@/lib/url";

/**
 * 이전 본문을 이력에 남긴다. git history를 대신하는 유일한 장치이므로
 * **본문을 덮어쓰기 전에** 부른다. append-only — 갱신·삭제 경로를 만들지 않는다.
 */
export async function recordVersion(input: {
  libraryId: string;
  path: string;
  content: string;
  contentSha: string;
  author: string;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("document_versions").insert({
    library_id: input.libraryId,
    path: input.path,
    content: input.content,
    content_sha: input.contentSha,
    author: input.author,
    note: input.note ?? null,
  });
  // 이력 적재가 실패해도 편집 자체는 이미 사용자 의도대로 끝났다. 되돌리지 않고 남긴다.
  if (error) console.error("mirror: recordVersion", error);
}

/**
 * 델타 피드 + 알림. 같은 요약 문자열 하나를 둘이 나눠 쓴다 —
 * 두 번 만들면 두 번 드리프트한다. (SPEC §8)
 */
export interface NotifiableLibrary {
  id: string;
  slug: string;
  mattermost_webhook_url: string | null;
  discord_webhook_url: string | null;
  /** 마지막으로 **실제 발송**한 시각. 디바운스 창의 기준점 */
  last_notified_at: string | null;
}

export async function recordChange(
  repo: NotifiableLibrary,
  edit: DocumentEdit,
): Promise<number | null> {
  const summary = summarizeEdit(edit);

  // note는 여기 넣지 않는다 — 원문은 document_versions.note에, 사람이 읽는 형태는
  // summary 안에 이미 있다. 세 번째 사본은 드리프트 자리만 만든다.
  const { data, error } = await supabase
    .from("sync_events")
    .insert({
      library_id: repo.id,
      author: edit.author,
      changed_paths: edit.after === null ? [] : [edit.path],
      deleted_paths: edit.after === null ? [edit.path] : [],
      summary,
    })
    .select("id")
    .maybeSingle();

  if (error) console.error("mirror: recordChange", error);
  const eventId: number | null = data?.id ?? null;

  // 비정규화된 최신 이벤트 id (D-012). 쓰기 경로는 여기 하나뿐이라 어긋날 자리가 없다.
  if (eventId !== null) {
    const { error: latestError } = await supabase
      .from("libraries")
      .update({ latest_event_id: eventId })
      .eq("id", repo.id);
    if (latestError) console.error("mirror: latest_event_id", latestError);
  }

  await maybeNotify(repo);
  return eventId;
}

/**
 * 디바운스 창(분). 0이면 즉시 발송 — 디바운스를 끄는 탈출구다.
 *
 * 5분인 근거는 실측이다. sync_events 49건을 묶어 보면 1분 창이 15건(69% 감소), 5분 창이
 * 10건(80%)이고 **15분 창도 10건**이다. 5분을 넘겨도 더 안 줄어든다는 뜻이라, 더 늘리면
 * 감소는 그대로인데 꼬리 지연만 길어진다.
 */
function windowMs(): number {
  const raw = Number(process.env.CUSHION_NOTIFY_WINDOW_MIN);
  return (Number.isFinite(raw) && raw >= 0 ? raw : 5) * 60_000;
}

/** 한 번에 묶어 볼 이벤트 수 상한. 이 뒤는 다음 발송으로 넘어간다 */
const MAX_BATCH = 500;

/**
 * 창이 열려 있으면 안 보낸다 — 쌓아 두고 창이 닫힌 뒤 첫 쓰기가 한 통으로 묶어 보낸다.
 *
 * **선두는 즉시 보낸다**(조용하다 처음 온 편집). 그래야 팀이 "누가 뭘 건드리기 시작했다"를
 * 바로 알고, 뒤따르는 연속 편집만 묶인다. 대신 버스트의 **꼬리는 다음 쓰기까지 지연된다** —
 * 크론이 없으니 창이 닫히는 걸 알려 줄 게 없다. 알림이 사라지는 건 아니고(`sync_events`에
 * 남고 변경 목록 화면에서 보인다) 늦을 뿐이다. 크론을 얹기로 하면 이 함수를 그대로
 * 부르면 된다 — 스키마가 같다.
 */
async function maybeNotify(repo: NotifiableLibrary): Promise<void> {
  // 채널이 없으면 상태를 건드리지 않는다. 나중에 웹훅을 붙였을 때 그때부터의 변경만 간다 —
  // 붙이는 순간 과거 수백 건이 쏟아지는 게 더 나쁘다.
  if (!repo.mattermost_webhook_url && !repo.discord_webhook_url) return;

  const previous = repo.last_notified_at;
  if (previous && Date.now() - Date.parse(previous) < windowMs()) return;

  /*
   * 창을 여는 것부터 한다. 조건부 UPDATE라 동시 쓰기 둘이 같은 창을 봤어도 하나만 통과한다 —
   * documents의 CAS와 같은 이유다. 먼저 읽고 보내고 나중에 표시하면 그 사이에 낀 쓰기가
   * 같은 묶음을 한 번 더 보낸다.
   */
  const now = new Date().toISOString();
  const claim = supabase.from("libraries").update({ last_notified_at: now }).eq("id", repo.id);
  const { data: claimed, error: claimError } = await (
    previous === null ? claim.is("last_notified_at", null) : claim.eq("last_notified_at", previous)
  ).select("id");

  if (claimError) {
    console.error("mirror: notify claim", claimError);
    return;
  }
  if (!claimed?.length) return; // 남이 이미 보내는 중

  const { data: pending, error } = await supabase
    .from("sync_events")
    .select("id, author, changed_paths, deleted_paths, summary")
    .eq("library_id", repo.id)
    .is("notified_at", null)
    .order("id", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    console.error("mirror: notify pending", error);
    return;
  }
  if (!pending?.length) return;

  const text = buildNotification({
    base: baseUrl(),
    slug: repo.slug,
    events: pending as PendingEvent[],
  });
  if (!text) return;

  await Promise.all([
    postWebhook(repo.mattermost_webhook_url, { text }),
    // Discord는 `content`만 읽는다 — `text`를 보내면 400이고, 그 실패는 조용하다.
    // 2000자가 상한이라 넘치면 통째로 거부당한다. 요약은 짧지만 상한을 믿지 않는다.
    postWebhook(repo.discord_webhook_url, { content: text.slice(0, 1900) }),
  ]);

  /*
   * 보낸 뒤에 표시한다. 먼저 표시하면 발송이 실패했을 때 그 변경들이 영구히 안 나간다 —
   * 중복 알림보다 나쁘다.
   *
   * `lte(마지막 본 id)`가 중요하다. "안 보낸 것 전부"로 표시하면 select와 update 사이에
   * 끼어든 쓰기의 이벤트까지 발송된 것으로 찍혀 **조용히 사라진다.**
   */
  const lastId = pending[pending.length - 1].id;
  const { error: markError } = await supabase
    .from("sync_events")
    .update({ notified_at: now })
    .eq("library_id", repo.id)
    .is("notified_at", null)
    .lte("id", lastId);
  if (markError) console.error("mirror: notify mark", markError);
}

/**
 * 알림 실패가 편집을 되돌리지 않는다. 문서는 이미 저장됐고, 그게 본질이다.
 * URL은 호출부가 이미 읽어 둔 레포 행에서 온다 — 알림 하나에 조회 하나를 더 쓰지 않는다.
 *
 * 페이로드는 호출부가 준다. 여기서 URL을 보고 종류를 추측하지 않는다 —
 * 어느 칸에 넣었는지가 이미 답이고, 추측은 틀리는 날이 온다.
 */
async function postWebhook(url: string | null, payload: Record<string, string>): Promise<void> {
  if (!url) return;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error("mirror: webhook", response.status, await response.text());
  } catch (cause) {
    console.error("mirror: webhook", cause);
  }
}

/**
 * 쓴 사람의 구독 커서를 방금 만든 이벤트까지 밀어 준다.
 *
 * 안 하면 **자기가 쓴 변경 때문에 자기 다음 호출에 `[stale]`이 붙는다.** 에이전트는 편집할
 * 때마다 헛되이 `doc_changes_since`를 부르게 되는데, 그게 정확히 이 도구가 없애려는 낭비다.
 * "안 밀렸으면 그 줄이 아예 없다"(D-005)를 지키려면 쓰기도 커서를 전진시켜야 한다.
 *
 * 웹 편집에는 토큰이 없다 — 그때는 부르지 않는다.
 */
export async function advanceCursor(
  tokenId: string,
  libraryId: string,
  eventId: number,
): Promise<void> {
  const { error } = await supabase.from("token_cursors").upsert(
    {
      token_id: tokenId,
      library_id: libraryId,
      last_event_id: eventId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token_id,library_id" },
  );
  if (error) console.error("mirror: advanceCursor", error);
}
