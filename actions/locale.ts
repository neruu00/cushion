"use server";

/**
 * @file actions/locale.ts
 * @description 표시 언어 수동 전환. 접속 국가로 정한 값을 사람이 덮어쓰는 유일한 경로다.
 *
 * 자동 판정만 두면 **한국에서 영어 화면을 볼 방법이 없다.** 배포 전에 영어 쪽을 눈으로
 * 확인할 수단이 없다는 뜻이고, 한국에 있는 영어 사용자·해외에 있는 한국어 사용자도
 * 매번 틀린 언어를 받는다. 지리는 좋은 기본값이지 결론이 아니다.
 *
 * 권한을 보지 않는다 — 로그인 없이 보는 랜딩·문서에서도 눌러야 하는 버튼이고,
 * 바뀌는 것은 자기 브라우저의 쿠키 하나뿐이다.
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/i18n";

export async function setLocale(formData: FormData): Promise<void> {
  const next = formData.get("locale");
  // 외부 입력이다. 아는 값이 아니면 조용히 무시한다 — 쿠키에 아무 문자열이나 앉히지 않는다
  if (!isLocale(next)) return;

  (await cookies()).set(LOCALE_COOKIE, next, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    // 언어는 비밀이 아니다. httpOnly로 잠그면 나중에 클라이언트에서 읽을 길만 막힌다
    httpOnly: false,
  });

  // 문구는 루트 레이아웃(헤더)부터 바뀐다. 레이아웃째로 다시 그린다
  revalidatePath("/", "layout");
}
