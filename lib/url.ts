/**
 * @file lib/url.ts
 * @description 앱 **밖으로** 나가는 링크의 단일 출처 — 알림 메시지, 붙여넣기용 설정 스니펫.
 *
 * 화면 안의 이동은 `<Link href="/libraries/…">` 상대 경로면 된다. 절대 URL이 필요한 건
 * 앱 밖으로 나가는 것뿐이고, 그때 도메인을 문자열로 박으면 배포마다 어긋난다.
 *
 * 순수 함수만 둔다 — DB도 fetch도 없다 (D-008). `node --test`가 직접 실행한다.
 */

/**
 * 앱의 공개 base URL.
 *
 * NextAuth는 `NEXTAUTH_URL` 없이도 요청 호스트로 잘 돈다. 그래서 배포할 때 이 값을
 * 빠뜨려도 로그인은 멀쩡하고 **여기서 만드는 링크만 조용히 `localhost`가 된다** —
 * 화면은 정상으로 보이는데 채널에 뿌린 알림의 링크가 아무 데서도 안 열리는 식이다.
 * 그래서 Vercel이 늘 넣어 주는 배포 도메인을 두 번째 후보로 둔다.
 */
export function baseUrl(): string {
  const explicit = process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

/**
 * 문서 경로를 URL에 넣을 수 있게. `/`는 세그먼트 구분이라 살리고 나머지만 인코딩한다 —
 * `encodeURIComponent(path)` 한 방이면 `docs/a.md`가 `docs%2Fa.md`가 돼 404가 난다.
 */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function libraryUrl(base: string, slug: string): string {
  return `${base}/libraries/${encodeURIComponent(slug)}`;
}

export function documentUrl(base: string, slug: string, path: string): string {
  return `${libraryUrl(base, slug)}/${encodePath(path)}`;
}

/** 지워진 문서는 보기 화면이 404다. 그때 가리킬 곳은 이력뿐이다. */
export function historyUrl(base: string, slug: string, path: string): string {
  return `${libraryUrl(base, slug)}/history/${encodePath(path)}`;
}

export function changesUrl(base: string, slug: string): string {
  return `${libraryUrl(base, slug)}/changes`;
}
