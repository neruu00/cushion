"use server";

/**
 * @file actions/repository.ts
 * @description 레포 등록 · sync 토큰 재발급 · 멤버 관리. 전부 admin 전용.
 *
 * proxy.ts는 서버 액션 호출을 막지 못한다. 그래서 모든 액션이 첫 줄에서 스스로 권한을 본다.
 * 순서를 지킨다: 권한 확인 → Zod 검증 → 로직 → 재검증
 */
import { revalidatePath } from "next/cache";

import type { SecretState } from "@/lib/action.type";
import { isAdmin } from "@/lib/authz";
import { createRepositorySchema, memberSchema } from "@/lib/repository.schema";
import { setupFiles } from "@/lib/snippets";
import { supabase } from "@/lib/supabase";

const DENIED = "관리자 권한이 필요합니다." as const;

export async function createRepository(
  _prev: SecretState,
  formData: FormData,
): Promise<SecretState> {
  if (!(await isAdmin())) return { success: false, error: DENIED };

  const parsed = createRepositorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase.from("repositories").insert(parsed.data);

  if (error) {
    console.error("createRepository", error);
    return {
      success: false,
      // 23505 = unique_violation. 그 외는 내부 사정이므로 사용자에게 말하지 않는다.
      error: error.code === "23505" ? "이미 있는 slug입니다." : "레포 생성에 실패했습니다.",
    };
  }

  revalidatePath("/admin");
  // 노출할 비밀이 없다 — 문서는 이 화면에서 바로 만든다. 붙여넣을 설정만 준다.
  return {
    success: true,
    data: {
      hint: `${parsed.data.slug} 등록됨. 문서는 /${parsed.data.slug} 에서 만든다`,
      files: setupFiles(),
    },
  };
}

export async function addMember(_prev: SecretState, formData: FormData): Promise<SecretState> {
  if (!(await isAdmin())) return { success: false, error: DENIED };

  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { error } = await supabase.from("repository_members").insert(parsed.data);
  if (error) {
    console.error("addMember", error);
    return {
      success: false,
      error: error.code === "23505" ? "이미 등록된 멤버입니다." : "등록에 실패했습니다.",
    };
  }

  revalidatePath("/admin");
  return { success: true };
}

/**
 * 삭제는 결과 표시 없이 재렌더로 끝낸다 — 실패하면 행이 그대로 남아 눈에 보인다.
 * 되돌리기가 "다시 추가"라 확인 다이얼로그도 두지 않는다.
 */
export async function removeMember(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;

  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { error } = await supabase
    .from("repository_members")
    .delete()
    .eq("repository_id", parsed.data.repository_id)
    .eq("email", parsed.data.email);

  if (error) console.error("removeMember", error);
  revalidatePath("/admin");
}
