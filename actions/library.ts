"use server";

/**
 * @file actions/repository.ts
 * @description 레포 등록 · 멤버 관리. 셀프서브다 (D-013) —
 *              생성은 로그인만으로, 멤버 관리는 그 레포의 멤버면 된다. admin은 어디나.
 *
 * proxy.ts는 서버 액션 호출을 막지 못한다. 그래서 모든 액션이 첫 줄에서 스스로 권한을 본다.
 * 순서를 지킨다: 권한 확인 → Zod 검증 → 로직 → 재검증
 */
import { revalidatePath } from "next/cache";

import type { SecretState } from "@/lib/action.type";
import { getSessionEmail, isAdmin, isMember } from "@/lib/authz";
import { createLibraryFor } from "@/lib/library";
import { librarySettingsSchema, memberSchema } from "@/lib/library.schema";
import { setupFiles } from "@/lib/snippets";
import { supabase } from "@/lib/supabase";

export async function createLibrary(
  _prev: SecretState,
  formData: FormData,
): Promise<SecretState> {
  // 로그인이면 누구나 만든다 (D-013). 열람·쓰기는 여전히 멤버만이다.
  const email = await getSessionEmail();
  if (!email) return { success: false, error: "로그인이 필요합니다." };

  // 생성 로직은 lib/repository.ts 하나뿐이다. MCP library_create도 같은 함수를 지난다.
  const result = await createLibraryFor(email, Object.fromEntries(formData));
  if (!result.ok) return { success: false, error: result.message };

  revalidatePath("/dashboard");
  return {
    success: true,
    data: {
      hint: `${result.slug} 만들었다. 문서는 /libraries/${result.slug} 에서, 붙이는 순서는 /settings/tokens 에서`,
      files: setupFiles(result.slug),
    },
  };
}

/** 멤버 관리 권한: 그 레포의 멤버거나 admin. 셀프서브에서 팀원을 못 부르면 반쪽이다. */
async function canManageMembers(email: string, libraryId: string): Promise<boolean> {
  if (await isAdmin()) return true;
  return isMember(email, libraryId);
}

export async function addMember(_prev: SecretState, formData: FormData): Promise<SecretState> {
  // 세션부터 — 레포 단위 판정은 library_id를 알아야 해서 Zod 뒤에 온다
  const email = await getSessionEmail();
  if (!email) return { success: false, error: "로그인이 필요합니다." };

  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  if (!(await canManageMembers(email, parsed.data.library_id))) {
    return { success: false, error: "이 레포의 멤버만 초대할 수 있습니다." };
  }

  const { error } = await supabase.from("library_members").insert(parsed.data);
  if (error) {
    console.error("addMember", error);
    return {
      success: false,
      error: error.code === "23505" ? "이미 등록된 멤버입니다." : "등록에 실패했습니다.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: true };
}

/** 이미 만든 라이브러리의 설정 갱신. 권한은 멤버 관리와 같은 문턱이다 (그 라이브러리의 멤버). */
export async function updateLibrary(_prev: SecretState, formData: FormData): Promise<SecretState> {
  const email = await getSessionEmail();
  if (!email) return { success: false, error: "로그인이 필요합니다." };

  const parsed = librarySettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { library_id, ...settings } = parsed.data;
  if (!(await canManageMembers(email, library_id))) {
    return { success: false, error: "이 라이브러리의 멤버만 바꿀 수 있습니다." };
  }

  // slug를 되받아 재검증에 쓴다 — 폼이 준 값을 믿고 경로를 만들지 않는다.
  const { data, error } = await supabase
    .from("libraries")
    .update(settings)
    .eq("id", library_id)
    .select("slug")
    .single();

  if (error || !data) {
    console.error("updateLibrary", error);
    return { success: false, error: "저장에 실패했습니다." };
  }

  revalidatePath(`/libraries/${data.slug}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin");

  const connected = [
    settings.mattermost_webhook_url ? "Mattermost" : null,
    settings.discord_webhook_url ? "Discord" : null,
  ].filter(Boolean);
  return {
    success: true,
    data: {
      hint: `저장됐다 — GitHub ${settings.github_repos.length}개 · 알림 ${
        connected.length > 0 ? connected.join(" · ") : "없음"
      }`,
    },
  };
}

/**
 * 삭제는 결과 표시 없이 재렌더로 끝낸다 — 실패하면 행이 그대로 남아 눈에 보인다.
 * 자기 자신 제거 = 나가기. 마지막 멤버가 나가면 admin만 보는 레포가 된다 — 막지 않는다.
 */
export async function removeMember(formData: FormData): Promise<void> {
  const email = await getSessionEmail();
  if (!email) return;

  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  if (!(await canManageMembers(email, parsed.data.library_id))) return;

  const { error } = await supabase
    .from("library_members")
    .delete()
    .eq("library_id", parsed.data.library_id)
    .eq("email", parsed.data.email);

  if (error) console.error("removeMember", error);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
