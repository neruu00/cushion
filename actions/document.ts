"use server";

/**
 * @file actions/document.ts
 * @description 웹 편집 화면의 문서 저장·삭제. 실제 쓰기는 `lib/document.ts`가 한다.
 *
 * proxy.ts는 서버 액션 호출을 막지 못한다. 그래서 첫 줄에서 스스로 세션을 본다.
 * 순서를 지킨다: 권한 확인 → Zod 검증 → 로직 → 재검증
 */
import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/lib/action.type";
import { getSessionEmail } from "@/lib/authz";
import { deleteDocument, putDocument } from "@/lib/document";
import { deleteDocumentSchema, putDocumentSchema } from "@/lib/document.schema";

/** 저장 성공 후 화면이 새 sha를 들고 있어야 연속 편집이 된다. */
export async function saveDocument(
  _prev: ActionResult<{ sha: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ sha: string }>> {
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

  if (!result.ok) return { success: false, error: result.message };

  revalidatePath(`/${parsed.data.repo}`);
  revalidatePath(`/${parsed.data.repo}/${parsed.data.path}`);
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

  revalidatePath(`/${parsed.data.repo}`);
}
