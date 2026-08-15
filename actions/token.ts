"use server";

/**
 * @file actions/token.ts
 * @description 개인 access token(`cshn_pat_`) 발급·폐기. 자기 것만 건드릴 수 있다.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { SecretState } from "@/lib/action.type";
import { getSessionEmail } from "@/lib/authz";
import { connectCommand } from "@/lib/snippets";
import { supabase } from "@/lib/supabase";
import { generateToken } from "@/lib/token";

const nameSchema = z.object({
  name: z.string().trim().max(50).optional(),
});

const revokeSchema = z.object({ id: z.uuid() });

export async function createAccessToken(
  _prev: SecretState,
  formData: FormData,
): Promise<SecretState> {
  const email = await getSessionEmail();
  if (!email) return { success: false, error: "로그인이 필요해요." };

  const parsed = nameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: "이름이 너무 길어요." };

  const token = generateToken("access");
  const { error } = await supabase.from("access_tokens").insert({
    email,
    token_hash: token.hash,
    name: parsed.data.name || null,
  });

  if (error) {
    console.error("createAccessToken", error);
    return { success: false, error: "발급하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/settings/tokens");
  return {
    success: true,
    data: {
      secret: token.plaintext,
      hint: "이 값은 다시 볼 수 없어요. 대개는 아래 명령만 복사하면 돼요",
      // 붙여넣기 한 번으로 끝나게 한다 — 레포 클론도 환경변수도 없이.
      files: [
        { name: "Claude Code에 연결 — 이 한 줄", content: connectCommand(token.plaintext) },
      ],
    },
  };
}

/**
 * 폐기는 삭제가 아니라 `revoked_at` 기록이다 — 언제 죽였는지가 유출 대응의 단서다.
 * `email` 조건이 없으면 남의 토큰을 죽일 수 있다. 그게 이 함수의 유일한 방어선이다.
 */
export async function revokeAccessToken(formData: FormData): Promise<void> {
  const email = await getSessionEmail();
  if (!email) return;

  const parsed = revokeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { error } = await supabase
    .from("access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("email", email)
    .is("revoked_at", null);

  if (error) console.error("revokeAccessToken", error);
  revalidatePath("/settings/tokens");
}
