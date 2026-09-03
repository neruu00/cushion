/**
 * @file lib/mirror.ts
 * @description 편집 한 번이 남기는 흔적 — 이력 · 델타 이벤트 · 알림.
 *
 * 알림은 **편집마다 한 통**이다. 시간 창으로 묶던 디바운스는 걷어냈다 —
 * 근거는 `notifyChange` 주석에.
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

  // 방금 만든 이벤트 하나를 그대로 보낸다. 대기분을 다시 조회하지 않는다 —
  // 보낼 내용을 이미 손에 들고 있다.
  await notifyChange(repo, eventId, {
    author: edit.author,
    changed_paths: edit.after === null ? [] : [edit.path],
    deleted_paths: edit.after === null ? [edit.path] : [],
    summary,
  });
  return eventId;
}

/**
 * 이 편집 하나를 채널로 보낸다. **묶지 않는다 — 편집마다 한 통이다.**
 *
 * 예전에는 `CUSHION_NOTIFY_WINDOW_MIN`분 창으로 디바운스했다. 도배는 줄었지만 창이
 * **라이브러리 단위**라 그 안에 들어온 남의 무관한 작업까지 한 통에 섞였다. 묶음의 기준이
 * "같은 작업"이 아니라 "같은 시간"이어서, 사람이 읽고 오해하는 편이 더 나빴다.
 * 시간은 작업의 대용물로 너무 거칠다.
 *
 * 묶을 축을 다시 고르기 전까지는 안 묶는다. 대신 알고 감수하는 비용이 둘 있다 —
 * 채널이 시끄러워지고(실측 49건 기준 10회 → 49회), 쓰기마다 웹훅 왕복을 기다린다.
 * 조용히 하고 싶으면 그 라이브러리의 웹훅 URL을 비우면 된다. 첫 줄에서 바로 빠진다.
 *
 * 창이 없어지면서 꼬리 지연도 없어졌다. 예전에는 버스트의 마지막 편집이 **다음 쓰기까지**
 * 발송을 기다렸다 — 크론이 없어 창이 닫히는 걸 알려 줄 게 없었다. 이제 그 상태가 없다.
 */
async function notifyChange(
  repo: NotifiableLibrary,
  eventId: number | null,
  event: PendingEvent,
): Promise<void> {
  // 채널이 없으면 아무것도 하지 않는다. 나중에 웹훅을 붙였을 때 그때부터의 변경만 간다 —
  // 붙이는 순간 과거 수백 건이 쏟아지는 게 더 나쁘다.
  if (!repo.mattermost_webhook_url && !repo.discord_webhook_url) return;

  const text = buildNotification({ base: baseUrl(), slug: repo.slug, events: [event] });
  if (!text) return;

  const [mattermost, discord] = await Promise.all([
    postWebhook(repo.mattermost_webhook_url, { text }),
    // Discord는 `content`만 읽는다 — `text`를 보내면 400이고, 그 실패는 조용하다.
    // 2000자가 상한이라 넘치면 통째로 거부당한다. 요약은 짧지만 상한을 믿지 않는다.
    postWebhook(repo.discord_webhook_url, { content: text.slice(0, 1900) }),
  ]);

  /*
   * **한 곳이라도 실제로 받았을 때만 표시한다.** 붙은 채널이 전부 실패했으면 `notified_at`을
   * null로 남긴다 — "안 나갔다"가 사실이고, 그 상태로 남아 있어야 나중에 재발송이나 묶음을
   * 붙일 때 이 행들이 대상이 된다.
   *
   * 편집마다 보내므로 발송 빈도가 올라가고 Discord 웹훅에는 레이트 리밋이 있다.
   * 429를 성공으로 찍으면 그 알림이 조용히 사라진다.
   */
  if (eventId === null || !(mattermost || discord)) return;

  const { error } = await supabase
    .from("sync_events")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) console.error("mirror: notify mark", error);
}

/**
 * 알림 실패가 편집을 되돌리지 않는다. 문서는 이미 저장됐고, 그게 본질이다.
 * URL은 호출부가 이미 읽어 둔 레포 행에서 온다 — 알림 하나에 조회 하나를 더 쓰지 않는다.
 *
 * 페이로드는 호출부가 준다. 여기서 URL을 보고 종류를 추측하지 않는다 —
 * 어느 칸에 넣었는지가 이미 답이고, 추측은 틀리는 날이 온다.
 *
 * **실제로 전달됐는지를 돌려준다.** 예외를 던지지 않는 건 그대로지만, 삼키고 void를 주면
 * 호출부가 429·500을 성공과 구분할 수 없어 `notified_at`을 찍어 버린다 — 그러면 그 알림이
 * 조용히 사라진다. 붙지 않은 채널(url === null)은 보낸 적이 없으므로 false다.
 */
async function postWebhook(url: string | null, payload: Record<string, string>): Promise<boolean> {
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.error("mirror: webhook", response.status, await response.text());
      return false;
    }
    return true;
  } catch (cause) {
    console.error("mirror: webhook", cause);
    return false;
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
