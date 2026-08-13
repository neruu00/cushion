/**
 * @file app/api/sync/route.ts
 * @description 레포가 미는 스펙 변경을 받는다 (T-301, T-304).
 *
 * Cushion은 GitHub을 당기지 않는다 — 자격증명을 하나도 갖지 않기 위해서다(D-006).
 * 인증은 sync 토큰(`cshn_sync_`)이고, 그 토큰이 곧 레포 식별자다. 그래서 레포 A의 토큰으로
 * 레포 B를 갱신하는 건 애초에 표현할 수 없다.
 *
 * 순서: 토큰 검증 → Zod 파싱 → documents upsert/삭제 → sync_events 적재 → Mattermost
 */
import type { NextRequest } from "next/server";

import { repoFromSyncToken } from "@/lib/authz";
import { buildSummary, documentTitle, notificationText } from "@/lib/summary";
import { supabase } from "@/lib/supabase";
import { syncPayloadSchema } from "@/lib/sync.schema";
import { sha256 } from "@/lib/token";

export async function POST(request: NextRequest) {
  const repo = await repoFromSyncToken(request.headers.get("authorization"));
  if (!repo) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = syncPayloadSchema.safeParse(body);
  if (!parsed.success) {
    console.error("sync: payload", repo.slug, parsed.error.issues);
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const payload = parsed.data;
  const now = new Date().toISOString();

  // ── 미러 갱신 ──────────────────────────────────────────────────────
  if (payload.changed.length > 0) {
    const { error } = await supabase.from("documents").upsert(
      payload.changed.map((file) => ({
        repository_id: repo.id,
        path: file.path,
        title: documentTitle(file.content),
        content: file.content,
        content_sha: sha256(file.content), // spec_get의 if_none_match가 이걸 본다
        commit_sha: payload.commit.sha || null,
        updated_at: now,
      })),
      { onConflict: "repository_id,path" },
    );
    if (error) {
      console.error("sync: upsert", repo.slug, error);
      return Response.json({ error: "mirror update failed" }, { status: 500 });
    }
  }

  // 삭제를 빠뜨리면 에이전트가 지워진 스펙을 읽는다. 이 도구가 없애려는 드리프트를
  // 이 도구가 만드는 셈이다. (SPEC §4)
  if (payload.deleted.length > 0) {
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("repository_id", repo.id)
      .in("path", payload.deleted);
    if (error) console.error("sync: delete", repo.slug, error);
  }

  // 전체 동기화: 페이로드에 없는 문서는 원본에서 사라진 것이다 (T-304).
  // changed가 비어 있으면 지우지 않는다 — 워크플로가 오작동해 빈 목록을 보냈을 때
  // 미러를 통째로 날리는 게 훨씬 나쁘다.
  let prunedPaths: string[] = [];
  if (payload.full && payload.changed.length > 0) {
    const keep = new Set(payload.changed.map((file) => file.path));
    const { data: existing, error } = await supabase
      .from("documents")
      .select("path")
      .eq("repository_id", repo.id);

    if (error) {
      console.error("sync: prune select", repo.slug, error);
    } else {
      prunedPaths = (existing ?? [])
        .map((row: { path: string }) => row.path)
        .filter((path) => !keep.has(path));

      if (prunedPaths.length > 0) {
        const { error: pruneError } = await supabase
          .from("documents")
          .delete()
          .eq("repository_id", repo.id)
          .in("path", prunedPaths);
        if (pruneError) console.error("sync: prune", repo.slug, pruneError);
      }
    }
  }

  // ── 델타 + 알림 (같은 요약을 나눠 쓴다) ────────────────────────────
  const deleted = [...payload.deleted, ...prunedPaths];

  // 아무것도 안 바뀌었으면 이벤트를 남기지 않는다. 빈 이벤트는 모든 토큰 커서를
  // 스테일로 만들어 놓고 정작 "변경 없음"만 돌려준다 — 이 도구가 없애려는 낭비다.
  if (payload.changed.length === 0 && deleted.length === 0) {
    return Response.json({ ok: true, upserted: 0, deleted: 0, event_id: null });
  }
  const summary = buildSummary({
    changed: payload.changed,
    deleted,
    diff: payload.diff,
    commit: payload.commit,
    truncated: payload.truncated,
    githubFullName: repo.github_full_name,
  });

  const { data: event, error: eventError } = await supabase
    .from("sync_events")
    .insert({
      repository_id: repo.id,
      commit_sha: payload.commit.sha || null,
      author: payload.commit.author || null,
      message: payload.commit.message || null,
      changed_paths: payload.changed.map((file) => file.path),
      deleted_paths: deleted,
      summary,
    })
    .select("id")
    .maybeSingle();

  if (eventError) console.error("sync: event", repo.slug, eventError);

  await notifyMattermost(repo.id, `**${repo.slug}**\n${notificationText(summary, payload.diff)}`);

  return Response.json({
    ok: true,
    upserted: payload.changed.length,
    deleted: deleted.length,
    event_id: event?.id ?? null,
  });
}

/**
 * 알림 실패가 동기화를 죽이면 안 된다. 미러는 이미 갱신됐고, 그게 본질이다.
 * webhook URL은 여기서만 필요해서 따로 읽는다 — 다른 조회 경로에 실어 나르지 않는다.
 */
async function notifyMattermost(repositoryId: string, text: string): Promise<void> {
  const { data, error } = await supabase
    .from("repositories")
    .select("mattermost_webhook_url")
    .eq("id", repositoryId)
    .maybeSingle();

  if (error) {
    console.error("sync: webhook lookup", error);
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
    if (!response.ok) console.error("sync: mattermost", response.status);
  } catch (cause) {
    console.error("sync: mattermost", cause);
  }
}
