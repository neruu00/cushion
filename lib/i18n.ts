/**
 * @file lib/i18n.ts
 * @description 요청 하나의 표시 언어를 정한다. **한국이면 한국어, 그 외에는 영어.**
 *
 * URL에 언어를 싣지 않는다. `/ko/docs` 같은 접두사를 두면 라우트 19개가 `app/[lang]/`
 * 아래로 내려가고 `Link`·`redirect`·`PageProps<>`가 전부 따라 움직이는데, 얻는 건
 * "언어별로 공유되는 주소" 하나뿐이다. 지금 필요한 건 **처음 보는 사람이 자기 언어로
 * 보는 것**이므로 주소는 그대로 두고 요청마다 판정한다.
 *
 * 캐시를 걱정하지 않아도 되는 이유: 루트 레이아웃의 `MainNav`가 세션을 읽어서
 * 이미 모든 페이지가 동적 렌더다. 여기서 헤더를 하나 더 읽는다고 정적 페이지가
 * 동적으로 떨어지는 일은 없다.
 *
 * ⚠️ **에이전트에게 나가는 텍스트는 여기를 지나지 않는다.** MCP 툴 설명·스킬 파일은
 *    영어 한 벌이다. 감지되는 국가는 "읽는 사람"이 아니라 그 CLI가 도는 머신이라
 *    분기의 근거가 되지 못하고, Claude Code 플러그인 설치 경로(`plugin.json`의
 *    `skills` 경로 하나)는 애초에 분기를 받지 못한다.
 */
import { cookies, headers } from "next/headers";

import { en, type Dict } from "@/lib/i18n.en";
import { ko } from "@/lib/i18n.ko";

export type Locale = "ko" | "en";

export const LOCALES: readonly Locale[] = ["ko", "en"];

/** 수동 전환이 남는 자리. 지리 판정보다 **먼저** 본다 — 사람이 고른 걸 뒤집지 않는다 */
export const LOCALE_COOKIE = "cushion_lang";

/** 1년. 언어 선택은 자주 바뀌는 값이 아니다 */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return value === "ko" || value === "en";
}

/**
 * Vercel이 요청에 붙여 주는 접속 국가. 로컬·자체호스팅에는 없다.
 * 없을 때만 `Accept-Language`로 떨어진다 — 국가 정보가 있으면 그게 우선이다.
 */
const COUNTRY_HEADER = "x-vercel-ip-country";

/** 한국에서 들어왔는가. 판정 규칙이 한 곳에만 있게 한다 */
const KOREA = "KR";

/**
 * `Accept-Language`가 한국어를 **1순위로** 원하는가.
 *
 * 문자열 어디든 `ko`가 있으면 한국어로 보는 방식은 쓰지 않는다. 브라우저는 대개
 * `en-US,en;q=0.9,ko;q=0.8`처럼 여러 개를 q값과 함께 보내는데, 그러면 영어를 쓰는
 * 사람도 한국어를 조금 아는 순간 한국어 화면을 받는다. 가장 앞선 항목만 본다.
 */
function prefersKorean(header: string | null): boolean {
  if (!header) return false;

  const best = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      // q가 없으면 1이다 (RFC 9110). 파싱 실패도 1로 본다 — 순서가 곧 선호도다
      const weight = q === undefined ? 1 : Number(q);
      return {
        tag: tag.trim().toLowerCase(),
        q: Number.isFinite(weight) ? weight : 1,
      };
    })
    .filter((item) => item.tag.length > 0)
    .sort((a, b) => b.q - a.q)[0];

  return best?.tag === "ko" || best?.tag.startsWith("ko-") || false;
}

/**
 * 이 요청의 언어. 서버 컴포넌트·서버 액션 어디서든 부른다.
 *
 * 순서: 쿠키(사람이 고름) → 접속 국가 → Accept-Language → 영어.
 */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  const head = await headers();

  const country = head.get(COUNTRY_HEADER);
  if (country) return country.toUpperCase() === KOREA ? "ko" : "en";

  // Vercel 밖(로컬 `pnpm dev`, 자체호스팅)에는 국가 헤더가 없다. 그때만 브라우저 선호를 본다.
  return prefersKorean(head.get("accept-language")) ? "ko" : "en";
}

/** 두 언어의 사전. `lib/i18n.en.ts`가 형태를, `lib/i18n.ko.ts`가 그 형태를 채운다 */
const DICTS: Record<Locale, Dict> = { ko, en };

/** 언어를 이미 알 때. 서버 컴포넌트가 자식에게 사전 조각을 내려 줄 때 쓴다 */
export function dictFor(locale: Locale): Dict {
  return DICTS[locale];
}

/** 이 요청의 사전. 서버 컴포넌트·서버 액션에서 부른다 */
export async function getDict(): Promise<Dict> {
  return DICTS[await getLocale()];
}

/**
 * 언어와 사전을 함께. 문구와 `<html lang>`을 한 번에 필요로 하는 자리(루트 레이아웃 등).
 */
export async function getI18n(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale();
  return { locale, t: DICTS[locale] };
}

/**
 * Zod 이슈 메시지를 요청 언어의 문장으로. 스키마는 메시지 자리에 **사전 키**를 넣으므로
 * (`lib/document.schema.ts` 참고) 그 키를 여기서 문장으로 바꾼다.
 *
 * 모르는 값은 그대로 돌려준다 — 우리가 메시지를 안 붙인 제약은 Zod 기본 문구(영어)로
 * 나온다. 드물게 영어가 섞이는 편이, 알 수 없는 키를 "입력을 확인하세요" 같은 뭉뚱그린
 * 문장으로 덮어 어느 칸이 틀렸는지 지워 버리는 것보다 낫다.
 */
export function translateIssue(issue: string, t: Dict): string {
  return issue in t.errors ? t.errors[issue as keyof Dict["errors"]] : issue;
}
