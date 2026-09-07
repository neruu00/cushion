"use server";

/**
 * @file actions/repository.ts
 * @description 레포 등록 · 멤버 관리. 셀프서브다 (D-013) —
 *              생성은 로그인만으로. 멤버 관리·설정 변경은 그 레포의 **소유자**만 된다 (D-021).
 *              admin은 어디나.
 *
 * proxy.ts는 서버 액션 호출을 막지 못한다. 그래서 모든 액션이 첫 줄에서 스스로 권한을 본다.
 * 순서를 지킨다: 권한 확인 → Zod 검증 → 로직 → 재검증
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { SecretState } from "@/lib/action.type";
import { getSessionEmail, isAdmin, isLibraryOwner, libraryFromInviteToken } from "@/lib/authz";
import { createLibraryFor } from "@/lib/library";
import {
  inviteActionSchema,
  joinInviteSchema,
  librarySettingsSchema,
  memberSchema,
} from "@/lib/library.schema";
import { getDict, translateIssue } from "@/lib/i18n";
import { setupFiles } from "@/lib/snippets";
import { supabase } from "@/lib/supabase";
import { generateToken } from "@/lib/token";
import { baseUrl, inviteUrl } from "@/lib/url";
import { fill } from "@/lib/utils";

export async function createLibrary(_prev: SecretState, formData: FormData): Promise<SecretState> {
  const t = await getDict();

  // 로그인이면 누구나 만든다 (D-013). 열람·쓰기는 여전히 멤버만이다.
  const email = await getSessionEmail();
  if (!email) return { success: false, error: t.errors.signInRequired };

  // 생성 로직은 lib/repository.ts 하나뿐이다. MCP library_create도 같은 함수를 지난다.
  const result = await createLibraryFor(email, Object.fromEntries(formData));
  if (!result.ok) {
    return {
      success: false,
      error: result.code === "invalid" ? translateIssue(result.issue, t) : t.errors[result.reason],
    };
  }

  revalidatePath("/dashboard");
  return {
    success: true,
    data: {
      hint: fill(t.hints.libraryCreated, { slug: result.slug }),
      files: setupFiles(result.slug, t.snippets),
    },
  };
}

/** 멤버 관리·설정 변경 권한: 그 레포의 소유자거나 admin (D-021). */
async function canManageLibrary(email: string, libraryId: string): Promise<boolean> {
  if (await isAdmin()) return true;
  return isLibraryOwner(email, libraryId);
}

export async function addMember(_prev: SecretState, formData: FormData): Promise<SecretState> {
  const t = await getDict();

  // 세션부터 — 레포 단위 판정은 library_id를 알아야 해서 Zod 뒤에 온다
  const email = await getSessionEmail();
  if (!email) return { success: false, error: t.errors.signInRequired };

  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: translateIssue(parsed.error.issues[0].message, t),
    };
  }

  if (!(await canManageLibrary(email, parsed.data.library_id))) {
    return { success: false, error: t.errors.ownerOnlyInvite };
  }

  const { error } = await supabase.from("library_members").insert(parsed.data);
  if (error) {
    console.error("addMember", error);
    return {
      success: false,
      error: error.code === "23505" ? t.errors.memberDuplicate : t.errors.memberFailed,
    };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { success: true };
}

/** 이미 만든 라이브러리의 설정 갱신. 권한은 멤버 관리와 같은 문턱이다 (그 라이브러리의 소유자, D-021). */
export async function updateLibrary(_prev: SecretState, formData: FormData): Promise<SecretState> {
  const t = await getDict();

  const email = await getSessionEmail();
  if (!email) return { success: false, error: t.errors.signInRequired };

  const parsed = librarySettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: translateIssue(parsed.error.issues[0].message, t),
    };
  }

  const { library_id, ...settings } = parsed.data;
  if (!(await canManageLibrary(email, library_id))) {
    return { success: false, error: t.errors.ownerOnlySettings };
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
    return { success: false, error: t.errors.settingsFailed };
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
      // 공개 여부는 결과 문구에서 확인할 수 있어야 한다 — 실수로 켠 걸 알아채는 지점이다
      hint: fill(t.hints.settingsSaved, {
        repos: settings.github_repos.length,
        channels: connected.length > 0 ? connected.join(" · ") : t.common.none,
        visibility: settings.is_public ? t.hints.visibilityPublic : t.hints.visibilityMembers,
      }),
    },
  };
}

/**
 * 삭제는 결과 표시 없이 재렌더로 끝낸다 — 실패하면 행이 그대로 남아 눈에 보인다.
 * 자기 자신 제거 = 나가기이고, 이건 소유자가 아니어도 항상 된다 — 못 나가면 셀프서브가 아니다.
 * 남을 빼는 건 소유자만 (D-021). 마지막 멤버가 나가면 admin만 보는 레포가 된다 — 막지 않는다.
 */
export async function removeMember(formData: FormData): Promise<void> {
  const email = await getSessionEmail();
  if (!email) return;

  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  // memberSchema가 이미 lowercase로 정규화해 준다 (SPEC §6) — 여기서 또 접지 않는다
  const leavingSelf = parsed.data.email === email;
  if (!leavingSelf && !(await canManageLibrary(email, parsed.data.library_id))) return;

  const { error } = await supabase
    .from("library_members")
    .delete()
    .eq("library_id", parsed.data.library_id)
    .eq("email", parsed.data.email);

  if (error) console.error("removeMember", error);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

/**
 * 초대 링크 생성. 재발급과 같은 모양이다(access token 재발급, SPEC §6) — 새 값을 만들고
 * 기존 살아있는 링크를 무효화한다. 라이브러리당 살아있는 링크가 항상 최대 하나인 이유가 그것
 * — "누가 아직 안 들어왔는지" 추적할 필요 없이 링크 하나만 신경 쓰면 된다.
 *
 * PAT처럼 **평문은 여기서만** 노출한다. DB엔 해시만 남아서, 다이얼로그를 닫으면 다시 못
 * 본다 — 잃어버리면 재발급이 맞다(공유용 링크라고 예외를 두지 않는다).
 */
export async function createInviteLink(
  _prev: SecretState,
  formData: FormData,
): Promise<SecretState> {
  const t = await getDict();

  const email = await getSessionEmail();
  if (!email) return { success: false, error: t.errors.signInRequired };

  const parsed = inviteActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: t.errors.badRequest };

  if (!(await canManageLibrary(email, parsed.data.library_id))) {
    return { success: false, error: t.errors.ownerOnlyLink };
  }

  const { error: revokeError } = await supabase
    .from("library_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("library_id", parsed.data.library_id)
    .is("revoked_at", null);
  if (revokeError) console.error("createInviteLink:revoke", revokeError.code, revokeError.message);

  const token = generateToken("invite");
  const { error } = await supabase.from("library_invites").insert({
    library_id: parsed.data.library_id,
    token_hash: token.hash,
    created_by: email,
  });

  if (error) {
    console.error("createInviteLink", error.code, error.message);
    return { success: false, error: t.errors.inviteFailed };
  }

  revalidatePath(`/libraries/${parsed.data.library_slug}`);
  return {
    success: true,
    data: {
      secret: inviteUrl(baseUrl(), token.plaintext),
      hint: t.hints.inviteCreated,
    },
  };
}

/** 무효화는 삭제가 아니라 `revoked_at` 기록이다(access token 폐기와 같은 이유). */
export async function revokeInviteLink(formData: FormData): Promise<void> {
  const email = await getSessionEmail();
  if (!email) return;

  const parsed = inviteActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  if (!(await canManageLibrary(email, parsed.data.library_id))) return;

  const { error } = await supabase
    .from("library_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("library_id", parsed.data.library_id)
    .is("revoked_at", null);

  if (error) console.error("revokeInviteLink", error.code, error.message);
  revalidatePath(`/libraries/${parsed.data.library_slug}`);
}

/**
 * `/invite/[token]`의 참여 버튼. 폼이 준 library_id를 믿지 않고 토큰에서 다시 찾는다 —
 * 그래야 무효화된 링크로는 아무리 폼을 조작해도 못 들어온다.
 *
 * 이미 멤버면 그냥 통과시킨다(23505 unique violation) — 링크를 두 번 눌러도 에러가 아니라
 * 라이브러리로 보내는 게 맞다.
 */
export async function joinLibrary(formData: FormData): Promise<void> {
  const email = await getSessionEmail();
  if (!email) return;

  const parsed = joinInviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const library = await libraryFromInviteToken(parsed.data.token);
  if (!library) return;

  const { error } = await supabase
    .from("library_members")
    .insert({ library_id: library.id, email });
  if (error && error.code !== "23505") {
    console.error("joinLibrary", error.code, error.message);
    return;
  }

  revalidatePath("/dashboard");
  redirect(`/libraries/${library.slug}`);
}
