/**
 * @file lib/document.ts
 * @description 문서 쓰기의 유일한 구현. 웹 편집 화면과 MCP 쓰기 툴이 이걸 공유한다.
 *
 * 두 벌로 만들면 한쪽만 이력을 남기거나 한쪽만 잠금을 확인하는 날이 온다.
 *
 * **동시 편집은 병합하지 않는다.** 원본이 DB에 있고 브랜치가 없으므로 병합할 근거가 없다.
 * 읽을 때 받은 sha를 쓸 때 되돌려 주게 하고(`base_sha`), 어긋나면 거부한 뒤 현재 sha를 알려준다.
 * `doc_get`의 `if_none_match`와 정확히 대칭이다.
 *
 * 잠금의 실체는 앱의 비교가 아니라 **DB의 조건부 쓰기다** (`content_sha = base_sha`인 행만
 * 갱신). 읽고-비교하고-쓰는 사이에 남이 끼어들면 앱 비교는 통과하고도 편집이 유실된다 —
 * 조건이 DB에 있으면 그 창이 없다.
 */
import { getAccessibleRepo } from "@/lib/authz";
import { advanceCursor, recordChange, recordVersion } from "@/lib/mirror";
import { replaceSection } from "@/lib/markdown";
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

/** CAS가 빗나갔을 때 현재 상태를 다시 읽어 conflict 응답을 만든다. */
async function conflictNow(repositoryId: string, path: string): Promise<WriteResult> {
  const { data } = await supabase
    .from("documents")
    .select("content, content_sha")
    .eq("repository_id", repositoryId)
    .eq("path", path)
    .maybeSingle();

  if (!data) {
    return { ok: false, code: "conflict", message: "그 사이 문서가 삭제됐다" };
  }
  return {
    ok: false,
    code: "conflict",
    currentSha: data.content_sha,
    currentContent: data.content,
    message: "그 사이 문서가 바뀌었다. doc_get으로 다시 읽고 새 sha로 다시 쓸 것",
  };
}

export async function putDocument(input: {
  email: string;
  repo: string;
  path: string;
  content: string;
  /** 주면 그 `##` 섹션만 교체한다. content는 헤딩 줄을 포함한 섹션 전체 */
  heading?: string;
  baseSha?: string;
  note?: string | null;
  /** MCP로 들어온 경우의 토큰 id. 주면 쓴 사람의 커서를 같이 전진시킨다 */
  tokenId?: string;
}): Promise<WriteResult> {
  const { repo, existing } = await resolve(input.email, input.repo, input.path);
  if (!repo) return { ok: false, code: "not_found", message: `그런 레포가 없다: ${input.repo}` };

  // 빠른 실패용 사전 비교. 실제 방어선은 아래 CAS다.
  if (existing && input.baseSha !== existing.content_sha) {
    return {
      ok: false,
      code: "conflict",
      currentSha: existing.content_sha,
      currentContent: existing.content,
      message: input.baseSha
        ? "그 사이 문서가 바뀌었다. doc_get으로 다시 읽고 새 sha로 다시 쓸 것"
        : "이미 있는 문서다. 덮어쓰려면 doc_get으로 받은 base_sha를 함께 보낼 것",
    };
  }
  if (!existing && input.baseSha) {
    return { ok: false, code: "conflict", message: "그 사이 문서가 삭제됐다" };
  }

  // 섹션 스코프 쓰기 — 문서 전체를 실어 보내지 않기 위한 것 (SPEC §7).
  // 잠금(base_sha)은 여전히 문서 전체 기준이다: 남이 다른 섹션을 고쳤어도 거부된다.
  // 병합하지 않는다는 원칙이 섹션 단위라고 달라지지 않는다.
  let content = input.content;
  if (input.heading !== undefined) {
    if (!existing) {
      return { ok: false, code: "invalid", message: "섹션 수정은 기존 문서에만 쓸 수 있다. 새 문서는 heading 없이 전체를 보낼 것" };
    }
    const merged = replaceSection(existing.content, input.heading, input.content);
    if (merged === null) {
      // 오타로 문서 끝에 덧붙는 것보다 거부가 낫다. 뭐가 있는지는 알려준다.
      return {
        ok: false,
        code: "invalid",
        message: `그런 섹션이 없다: ${input.heading}. doc_outline으로 헤딩을 확인할 것`,
      };
    }
    content = merged;
  }

  const sha = sha256(content);
  const now = new Date().toISOString();
  const row = {
    title: documentTitle(content),
    content,
    content_sha: sha,
    updated_at: now,
    updated_by: input.email,
  };

  if (existing) {
    // CAS: content_sha가 아직 base_sha인 행만 갱신된다. 0행 = 그 사이 누가 이겼다.
    const { data: updated, error } = await supabase
      .from("documents")
      .update(row)
      .eq("repository_id", repo.id)
      .eq("path", input.path)
      .eq("content_sha", input.baseSha as string)
      .select("id");

    if (error) {
      console.error("document: put", error);
      return { ok: false, code: "failed", message: "저장에 실패했다" };
    }
    if (!updated || updated.length === 0) return conflictNow(repo.id, input.path);
  } else {
    const { error } = await supabase.from("documents").insert({
      repository_id: repo.id,
      path: input.path,
      ...row,
    });

    if (error) {
      // 23505 = 유니크 충돌. 같은 경로를 동시에 만들었다 — 조용히 덮지 않고 알린다.
      if (error.code === "23505") return conflictNow(repo.id, input.path);
      console.error("document: put", error);
      return { ok: false, code: "failed", message: "저장에 실패했다" };
    }
  }

  // 이력은 CAS 성공 **후에** 남긴다. 실패한 쓰기의 이력이 남으면 안 된다.
  // CAS가 통과했다는 것 자체가 existing.content가 직전 본문이었다는 증명이다.
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

  const eventId = await recordChange(repo, {
    path: input.path,
    before: existing?.content ?? null,
    after: content,
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

  // 삭제도 CAS다 — 검사 후 지우기 전에 누가 고쳤으면 그 편집이 조용히 사라진다.
  const { data: deleted, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", existing.id)
    .eq("content_sha", input.baseSha)
    .select("id");

  if (error) {
    console.error("document: delete", error);
    return { ok: false, code: "failed", message: "삭제에 실패했다" };
  }
  if (!deleted || deleted.length === 0) return conflictNow(repo.id, input.path);

  // 마지막 본문을 남긴다 — 삭제야말로 되돌릴 수 있어야 한다.
  await recordVersion({
    repositoryId: repo.id,
    path: input.path,
    content: existing.content,
    contentSha: existing.content_sha,
    author: input.email,
    note: input.note,
  });

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
