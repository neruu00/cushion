/**
 * @file lib/document.ts
 * @description 문서 쓰기의 유일한 구현. 웹 편집 화면과 MCP 쓰기 툴이 이걸 공유한다.
 *
 * 두 벌로 만들면 한쪽만 이력을 남기거나 한쪽만 잠금을 확인하는 날이 온다.
 *
 * **동시 편집은 병합하지 않는다.** 원본이 DB에 있고 브랜치가 없으므로 병합할 근거가 없다.
 * 읽을 때 받은 sha를 쓸 때 되돌려 주게 하고(`base_sha`), 어긋나면 거부한 뒤 현재 sha를 알려준다.
 * `spec_get`의 `if_none_match`와 정확히 대칭이다.
 */
import { getAccessibleRepo } from "@/lib/authz";
import { advanceCursor, recordChange, recordVersion } from "@/lib/mirror";
import { supabase } from "@/lib/supabase";
import { documentTitle } from "@/lib/summary";
import { sha256 } from "@/lib/token";

export type WriteFailure = "not_found" | "conflict" | "invalid" | "failed";

export type WriteResult =
  | { ok: true; sha: string; eventId: number | null; repositoryId: string }
  | {
      ok: false;
      code: WriteFailure;
      message: string;
      /** 충돌일 때만. 이 둘이 있어야 호출부가 스스로 회복한다 */
      currentSha?: string;
      currentContent?: string;
    };

interface Existing {
  id: string;
  content: string;
  content_sha: string;
}

/** 권한 없음과 없음을 구분하지 않는다 — 구분하면 레포의 존재가 새어 나간다. (SPEC §6) */
async function resolve(email: string, slug: string, path: string) {
  const repo = await getAccessibleRepo(email, slug);
  if (!repo) return { repo: null, existing: null as Existing | null };

  const { data, error } = await supabase
    .from("documents")
    .select("id, content, content_sha")
    .eq("repository_id", repo.id)
    .eq("path", path)
    .maybeSingle();

  if (error) console.error("document: resolve", error);
  return { repo, existing: (data ?? null) as Existing | null };
}

export async function putDocument(input: {
  email: string;
  repo: string;
  path: string;
  content: string;
  baseSha?: string;
  note?: string | null;
  /** MCP로 들어온 경우의 토큰 id. 주면 쓴 사람의 커서를 같이 전진시킨다 */
  tokenId?: string;
}): Promise<WriteResult> {
  const { repo, existing } = await resolve(input.email, input.repo, input.path);
  if (!repo) return { ok: false, code: "not_found", message: `그런 레포가 없다: ${input.repo}` };

  if (existing && input.baseSha !== existing.content_sha) {
    return {
      ok: false,
      code: "conflict",
      currentSha: existing.content_sha,
      currentContent: existing.content,
      message: input.baseSha
        ? "그 사이 문서가 바뀌었다. spec_get으로 다시 읽고 새 sha로 다시 쓸 것"
        : "이미 있는 문서다. 덮어쓰려면 spec_get으로 받은 base_sha를 함께 보낼 것",
    };
  }
  if (!existing && input.baseSha) {
    return { ok: false, code: "conflict", message: "그 사이 문서가 삭제됐다" };
  }

  const sha = sha256(input.content);
  const now = new Date().toISOString();

  // 덮어쓰기 전에 이전 본문을 남긴다. 이게 git history를 대신하는 전부다.
  if (existing) {
    await recordVersion({
      repositoryId: repo.id,
      path: input.path,
      content: existing.content,
      contentSha: existing.content_sha,
      author: input.email,
      note: input.note,
    });
  }

  const { error } = await supabase.from("documents").upsert(
    {
      repository_id: repo.id,
      path: input.path,
      title: documentTitle(input.content),
      content: input.content,
      content_sha: sha,
      updated_at: now,
      updated_by: input.email,
    },
    { onConflict: "repository_id,path" },
  );

  if (error) {
    console.error("document: put", error);
    return { ok: false, code: "failed", message: "저장에 실패했다" };
  }

  const eventId = await recordChange(repo, {
    path: input.path,
    before: existing?.content ?? null,
    after: input.content,
    author: input.email,
    note: input.note,
  });
  if (input.tokenId && eventId !== null) await advanceCursor(input.tokenId, repo.id, eventId);

  return { ok: true, sha, eventId, repositoryId: repo.id };
}

export async function deleteDocument(input: {
  email: string;
  repo: string;
  path: string;
  baseSha: string;
  note?: string | null;
  tokenId?: string;
}): Promise<WriteResult> {
  const { repo, existing } = await resolve(input.email, input.repo, input.path);
  if (!repo) return { ok: false, code: "not_found", message: `그런 레포가 없다: ${input.repo}` };
  if (!existing) return { ok: false, code: "not_found", message: `그런 문서가 없다: ${input.path}` };

  if (input.baseSha !== existing.content_sha) {
    return {
      ok: false,
      code: "conflict",
      currentSha: existing.content_sha,
      currentContent: existing.content,
      message: "그 사이 문서가 바뀌었다. 다시 읽고 확인한 뒤 지울 것",
    };
  }

  // 지우기 전에 마지막 본문을 남긴다 — 삭제야말로 되돌릴 수 있어야 한다.
  await recordVersion({
    repositoryId: repo.id,
    path: input.path,
    content: existing.content,
    contentSha: existing.content_sha,
    author: input.email,
    note: input.note,
  });

  const { error } = await supabase.from("documents").delete().eq("id", existing.id);
  if (error) {
    console.error("document: delete", error);
    return { ok: false, code: "failed", message: "삭제에 실패했다" };
  }

  const eventId = await recordChange(repo, {
    path: input.path,
    before: existing.content,
    after: null,
    author: input.email,
    note: input.note,
  });
  if (input.tokenId && eventId !== null) await advanceCursor(input.tokenId, repo.id, eventId);

  return { ok: true, sha: existing.content_sha, eventId, repositoryId: repo.id };
}
