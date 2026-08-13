/**
 * @file lib/mirror.ts
 * @description 편집 한 번이 남기는 흔적 — 이력 · 델타 이벤트 · 알림.
 *
 * 세 곳(웹 편집 화면, MCP 쓰기 툴, 삭제)이 같은 뒷정리를 해야 한다. 한 군데라도 빠지면
 * 이력이 비거나, 에이전트가 변경을 못 보거나(`[stale]`이 안 뜬다), 팀이 알림을 못 받는다.
 * 그래서 쓰기 경로는 전부 여기를 지난다.
 */
import { summarizeEdit, type DocumentEdit } from "@/lib/summary";
import { supabase } from "@/lib/supabase";

/**
 * 이전 본문을 이력에 남긴다. git history를 대신하는 유일한 장치이므로
 * **본문을 덮어쓰기 전에** 부른다. append-only — 갱신·삭제 경로를 만들지 않는다.
 */
export async function recordVersion(input: {
  repositoryId: string;
  path: string;
  content: string;
  contentSha: string;
  author: string;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("document_versions").insert({
    repository_id: input.repositoryId,
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
export async function recordChange(
  repo: { id: string; slug: string },
  edit: DocumentEdit,
): Promise<number | null> {
  const summary = summarizeEdit(edit);

  const { data, error } = await supabase
    .from("sync_events")
    .insert({
      repository_id: repo.id,
      author: edit.author,
      message: edit.note ?? null,
      changed_paths: edit.after === null ? [] : [edit.path],
      deleted_paths: edit.after === null ? [edit.path] : [],
      summary,
    })
    .select("id")
    .maybeSingle();

  if (error) console.error("mirror: recordChange", error);

  await notifyMattermost(repo.id, `**${repo.slug}**\n${summary}`);
  return data?.id ?? null;
}

/**
 * 알림 실패가 편집을 되돌리지 않는다. 문서는 이미 저장됐고, 그게 본질이다.
 * webhook URL은 여기서만 읽는다 — 다른 조회 경로에 실어 나르지 않는다.
 */
async function notifyMattermost(repositoryId: string, text: string): Promise<void> {
  const { data, error } = await supabase
    .from("repositories")
    .select("mattermost_webhook_url")
    .eq("id", repositoryId)
    .maybeSingle();

  if (error) {
    console.error("mirror: webhook lookup", error);
    return;
  }
  const url: string | null = data?.mattermost_webhook_url ?? null;
  if (!url) return;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error("mirror: mattermost", response.status);
  } catch (cause) {
    console.error("mirror: mattermost", cause);
  }
}

/**
 * 쓴 사람의 구독 커서를 방금 만든 이벤트까지 밀어 준다.
 *
 * 안 하면 **자기가 쓴 변경 때문에 자기 다음 호출에 `[stale]`이 붙는다.** 에이전트는 편집할
 * 때마다 헛되이 `spec_changes_since`를 부르게 되는데, 그게 정확히 이 도구가 없애려는 낭비다.
 * "안 밀렸으면 그 줄이 아예 없다"(D-005)를 지키려면 쓰기도 커서를 전진시켜야 한다.
 *
 * 웹 편집에는 토큰이 없다 — 그때는 부르지 않는다.
 */
export async function advanceCursor(
  tokenId: string,
  repositoryId: string,
  eventId: number,
): Promise<void> {
  const { error } = await supabase.from("token_cursors").upsert(
    {
      token_id: tokenId,
      repository_id: repositoryId,
      last_event_id: eventId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token_id,repository_id" },
  );
  if (error) console.error("mirror: advanceCursor", error);
}
