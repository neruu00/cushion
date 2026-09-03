/**
 * @file lib/repository.ts
 * @description 레포 생성의 **유일한 경로**. 웹 폼도 MCP `library_create`도 여기로 모인다.
 *
 * 두 벌로 만들면 한쪽만 생성자를 멤버로 넣거나 한쪽만 보상 삭제를 하는 날이 온다 —
 * 그 순간 만든 사람이 자기 레포를 못 보는 고아가 태어나고, 원인은 며칠 뒤에 드러난다.
 * (lib/document.ts가 쓰기 경로를 하나로 모으는 것과 같은 이유)
 */
import { createLibrarySchema } from "@/lib/library.schema";
import { supabase } from "@/lib/supabase";

export type CreateLibraryResult =
  | { ok: true; slug: string; id: string }
  | { ok: false; code: "invalid" | "duplicate" | "failed"; message: string };

/**
 * 로그인(또는 유효 토큰)이면 누구나 만든다 (D-013). 호출부가 이미 신원을 확인했다는 전제다 —
 * `email`이 곧 그 확인 결과이므로 여기서 다시 세션을 보지 않는다.
 */
export async function createLibraryFor(
  email: string,
  input: Record<string, unknown>,
): Promise<CreateLibraryResult> {
  const parsed = createLibrarySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "invalid", message: parsed.error.issues[0].message };
  }

  // 만든 사람이 소유자다 (D-021) — 멤버 관리·설정·이력 되돌리기를 할 수 있는 단 한 사람.
  const { data: repo, error } = await supabase
    .from("libraries")
    .insert({ ...parsed.data, owner_email: email.toLowerCase() })
    .select("id, slug")
    .single();

  if (error || !repo) {
    console.error("createLibraryFor", error);
    // 23505 = unique_violation. 그 외는 내부 사정이므로 사용자에게 말하지 않는다.
    return error?.code === "23505"
      ? { ok: false, code: "duplicate", message: "이미 있는 slug예요." }
      : { ok: false, code: "failed", message: "라이브러리를 만들지 못했어요." };
  }

  // 만든 사람이 첫 멤버다. 실패하면 레포를 지워 보상한다 —
  // 안 그러면 만든 사람이 자기 레포를 못 보는 고아가 태어난다.
  const { error: memberError } = await supabase
    .from("library_members")
    .insert({ library_id: repo.id, email: email.toLowerCase() });

  if (memberError) {
    console.error("createLibraryFor: 첫 멤버 등록 실패, 보상 삭제", memberError);
    await supabase.from("libraries").delete().eq("id", repo.id);
    return { ok: false, code: "failed", message: "라이브러리를 만들지 못했어요." };
  }

  return { ok: true, slug: repo.slug, id: repo.id };
}
