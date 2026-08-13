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
import { createRepositorySchema, memberSchema, webhooksSchema } from "@/lib/repository.schema";
import { setupFiles } from "@/lib/snippets";
import { supabase } from "@/lib/supabase";

export async function createRepository(
  _prev: SecretState,
  formData: FormData,
): Promise<SecretState> {
  // 로그인이면 누구나 만든다 (D-013). 열람·쓰기는 여전히 멤버만이다.
  const email = await getSessionEmail();
  if (!email) return { success: false, error: "로그인이 필요합니다." };

  const parsed = createRepositorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data: repo, error } = await supabase
    .from("repositories")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error || !repo) {
    console.error("createRepository", error);
    return {
      success: false,
      // 23505 = unique_violation. 그 외는 내부 사정이므로 사용자에게 말하지 않는다.
      error: error?.code === "23505" ? "이미 있는 slug입니다." : "레포 생성에 실패했습니다.",
    };
  }

  // 만든 사람이 첫 멤버다. 실패하면 레포를 지워 보상한다 —
  // 안 그러면 만든 사람이 자기 레포를 못 보는 고아가 태어난다.
  const { error: memberError } = await supabase
    .from("repository_members")
    .insert({ repository_id: repo.id, email });

  if (memberError) {
    console.error("createRepository: 첫 멤버 등록 실패, 보상 삭제", memberError);
    await supabase.from("repositories").delete().eq("id", repo.id);
    return { success: false, error: "레포 생성에 실패했습니다." };
  }

  revalidatePath("/dashboard");
  return {
    success: true,
    data: {
      hint: `${parsed.data.slug} 등록됨. 문서는 /repositories/${parsed.data.slug} 에서 만든다`,
      files: setupFiles(),
    },
  };
}

/** 멤버 관리 권한: 그 레포의 멤버거나 admin. 셀프서브에서 팀원을 못 부르면 반쪽이다. */
async function canManageMembers(email: string, repositoryId: string): Promise<boolean> {
  if (await isAdmin()) return true;
  return isMember(email, repositoryId);
}

export async function addMember(_prev: SecretState, formData: FormData): Promise<SecretState> {
  // 세션부터 — 레포 단위 판정은 repository_id를 알아야 해서 Zod 뒤에 온다
  const email = await getSessionEmail();
  if (!email) return { success: false, error: "로그인이 필요합니다." };

  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  if (!(await canManageMembers(email, parsed.data.repository_id))) {
    return { success: false, error: "이 레포의 멤버만 초대할 수 있습니다." };
  }

  const { error } = await supabase.from("repository_members").insert(parsed.data);
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

/** 이미 만든 레포의 알림 채널 갱신. 권한은 멤버 관리와 같은 문턱이다 (그 레포의 멤버). */
export async function updateWebhooks(
  _prev: SecretState,
  formData: FormData,
): Promise<SecretState> {
  const email = await getSessionEmail();
  if (!email) return { success: false, error: "로그인이 필요합니다." };

  const parsed = webhooksSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { repository_id, ...webhooks } = parsed.data;
  if (!(await canManageMembers(email, repository_id))) {
    return { success: false, error: "이 레포의 멤버만 바꿀 수 있습니다." };
  }

  // slug를 되받아 재검증에 쓴다 — 폼이 준 값을 믿고 경로를 만들지 않는다.
  const { data, error } = await supabase
    .from("repositories")
    .update(webhooks)
    .eq("id", repository_id)
    .select("slug")
    .single();

  if (error || !data) {
    console.error("updateWebhooks", error);
    return { success: false, error: "저장에 실패했습니다." };
  }

  revalidatePath(`/repositories/${data.slug}`);
  revalidatePath("/admin");

  const connected = [
    webhooks.mattermost_webhook_url ? "Mattermost" : null,
    webhooks.discord_webhook_url ? "Discord" : null,
  ].filter(Boolean);
  return {
    success: true,
    data: {
      hint: connected.length > 0 ? `저장됐다 — ${connected.join(" · ")}` : "저장됐다 — 연결 없음",
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

  if (!(await canManageMembers(email, parsed.data.repository_id))) return;

  const { error } = await supabase
    .from("repository_members")
    .delete()
    .eq("repository_id", parsed.data.repository_id)
    .eq("email", parsed.data.email);

  if (error) console.error("removeMember", error);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
