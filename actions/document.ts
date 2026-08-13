"use server";

/**
 * @file actions/document.ts
 * @description 웹 편집 화면의 문서 저장·삭제. 실제 쓰기는 `lib/document.ts`가 한다.
 *
 * proxy.ts는 서버 액션 호출을 막지 못한다. 그래서 첫 줄에서 스스로 세션을 본다.
 * 순서를 지킨다: 권한 확인 → Zod 검증 → 로직 → 재검증
 */
import { revalidatePath } from "next/cache";

import type { SaveResult } from "@/lib/action.type";
import { getSessionEmail } from "@/lib/authz";
import { deleteDocument, putDocument } from "@/lib/document";
import { deleteDocumentSchema, putDocumentSchema, restoreSchema } from "@/lib/document.schema";
import { getAccessibleRepo } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

/**
 * 저장 성공 후 화면이 새 sha를 들고 있어야 연속 편집이 된다.
 * 충돌이면 현재 sha와 서버 본문을 같이 돌려준다 — 안 그러면 재시도가 영원히 같은 sha로 실패한다.
 */
export async function saveDocument(
  _prev: SaveResult | null,
  formData: FormData,
): Promise<SaveResult> {
  const email = await getSessionEmail();
  if (!email) return { success: false, error: "로그인이 필요합니다." };

  const parsed = putDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const result = await putDocument({
    email,
    repo: parsed.data.repo,
    path: parsed.data.path,
    content: parsed.data.content,
    // 빈 문자열로 오는 hidden input을 "없음"으로 접는다 (새 문서)
    baseSha: parsed.data.base_sha || undefined,
    note: parsed.data.note,
  });

  if (!result.ok) {
    return {
      success: false,
      error: result.message,
      ...(result.currentSha !== undefined && result.currentContent !== undefined
        ? { conflict: { sha: result.currentSha, content: result.currentContent } }
        : {}),
    };
  }

  revalidatePath(`/repositories/${parsed.data.repo}`);
  revalidatePath(`/repositories/${parsed.data.repo}/${parsed.data.path}`);
  return { success: true, data: { sha: result.sha } };
}

export async function removeDocument(formData: FormData): Promise<void> {
  const email = await getSessionEmail();
  if (!email) return;

  const parsed = deleteDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const result = await deleteDocument({
    email,
    repo: parsed.data.repo,
    path: parsed.data.path,
    baseSha: parsed.data.base_sha,
    note: parsed.data.note,
  });
  if (!result.ok) console.error("removeDocument", result.code, result.message);

  revalidatePath(`/repositories/${parsed.data.repo}`);
}

/**
 * 이력의 한 버전으로 되돌린다. **덮어쓰기가 아니라 새 저장이다** —
 * 되돌리기 자체도 이력에 한 줄 남아야 "언제 무엇으로 되돌렸나"를 나중에 알 수 있다.
 * 지워진 문서도 되돌릴 수 있다(이력이 문서가 아니라 경로에 매달려 있어서).
 */
export async function restoreVersion(formData: FormData): Promise<void> {
  const email = await getSessionEmail();
  if (!email) return;

  const parsed = restoreSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const repo = await getAccessibleRepo(email, parsed.data.repo);
  if (!repo) return;

  // 버전이 정말 이 레포·이 경로의 것인지 확인한다. id만 믿으면 남의 이력을 끌어올 수 있다.
  const { data: version, error } = await supabase
    .from("document_versions")
    .select("content, created_at")
    .eq("id", parsed.data.version_id)
    .eq("repository_id", repo.id)
    .eq("path", parsed.data.path)
    .maybeSingle();

  if (error || !version) {
    console.error("restoreVersion: 버전을 찾을 수 없다", error);
    return;
  }

  // 지워진 문서면 base_sha 없이 다시 만든다.
  const { data: current } = await supabase
    .from("documents")
    .select("content_sha")
    .eq("repository_id", repo.id)
    .eq("path", parsed.data.path)
    .maybeSingle();

  const result = await putDocument({
    email,
    repo: parsed.data.repo,
    path: parsed.data.path,
    content: version.content,
    baseSha: current?.content_sha,
    note: `${version.created_at.slice(0, 19)} 버전으로 되돌림`,
  });
  if (!result.ok) console.error("restoreVersion", result.code, result.message);

  revalidatePath(`/repositories/${parsed.data.repo}/${parsed.data.path}`);
  revalidatePath(`/repositories/${parsed.data.repo}/history/${parsed.data.path}`);
}
