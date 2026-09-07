/**
 * @file lib/docs.ts
 * @description 문서 페이지 목차. 사이드바·이전/다음·전환 방향이 **이 배열 하나**를 본다.
 *
 * 순서가 데이터인 이유: 사이드바에서 아래로 가면 `docs-forward`, 위로 가면 `docs-back`이다.
 * 화면마다 순서를 따로 적으면 링크는 아래를 가리키는데 화면은 뒤로 미끄러지는 날이 온다.
 *
 * **제목·요약은 여기 없다.** 사전(`lib/i18n.*.ts`)의 `docsNav` 키만 들고 있고, 문자열은
 * `docsPages(t)`가 요청 언어로 채운다 — 순서(구조)와 문구(번역)를 한 배열에 섞으면
 * 언어를 더할 때마다 순서까지 복제된다.
 */
import type { Dict } from "@/lib/i18n.en";

export interface DocsPage {
  href: string;
  title: string;
  /** 사이드바 아래 한 줄. 목차가 곧 요약이 되게 한다 */
  summary: string;
}

/** 순서와 주소. 언어와 무관한 부분이다 */
const ORDER = [
  { href: "/docs", title: "overview", summary: "overviewSummary" },
  { href: "/docs/install", title: "install", summary: "installSummary" },
  { href: "/docs/usage", title: "usage", summary: "usageSummary" },
  { href: "/docs/skills", title: "skills", summary: "skillsSummary" },
] as const satisfies readonly {
  href: string;
  title: keyof Dict["docsNav"];
  summary: keyof Dict["docsNav"];
}[];

/** 요청 언어로 채운 목차. 서버 컴포넌트가 만들어 클라이언트 사이드바에 내려 준다 */
export function docsPages(t: Dict["docsNav"]): DocsPage[] {
  return ORDER.map((page) => ({
    href: page.href,
    title: t[page.title],
    summary: t[page.summary],
  }));
}

/**
 * `useSelectedLayoutSegment()`가 주는 세그먼트를 목차의 인덱스로 바꾼다.
 * 인덱스 하나면 활성 표시와 전환 방향이 둘 다 나온다.
 */
export function docsIndexOf(segment: string | null): number {
  const href = segment === null ? "/docs" : `/docs/${segment}`;
  return ORDER.findIndex((page) => page.href === href);
}

/** 이전·다음. 목차 순서를 아는 유일한 자리가 여기 하나가 되게 한다 */
export function docsNeighbours(current: string, t: Dict["docsNav"]) {
  const pages = docsPages(t);
  const index = pages.findIndex((page) => page.href === current);
  return {
    previous: index > 0 ? pages[index - 1] : null,
    next: index >= 0 && index < pages.length - 1 ? pages[index + 1] : null,
  };
}
