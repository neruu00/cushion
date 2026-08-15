/**
 * @file lib/docs.ts
 * @description 문서 페이지 목차. 사이드바·이전/다음·전환 방향이 **이 배열 하나**를 본다.
 *
 * 순서가 데이터인 이유: 사이드바에서 아래로 가면 `docs-forward`, 위로 가면 `docs-back`이다.
 * 화면마다 순서를 따로 적으면 링크는 아래를 가리키는데 화면은 뒤로 미끄러지는 날이 온다.
 *
 * 나중에 영어를 붙일 때 갈아끼울 곳도 여기다 — `title`·`summary`가 라우트 밖에 있어서
 * `app/[lang]/docs`로 감쌀 때 이 배열만 언어별로 고르면 된다.
 */
export interface DocsPage {
  href: string;
  title: string;
  /** 사이드바 아래 한 줄. 목차가 곧 요약이 되게 한다 */
  summary: string;
}

export const DOCS_PAGES: DocsPage[] = [
  { href: "/docs", title: "개요", summary: "무엇을, 왜" },
  { href: "/docs/install", title: "설치", summary: "붙이는 데 세 단계" },
  { href: "/docs/usage", title: "사용법", summary: "doc_* 툴과 읽기·쓰기" },
  { href: "/docs/skills", title: "스킬", summary: "슬래시 명령 5종" },
];

/**
 * `useSelectedLayoutSegment()`가 주는 세그먼트를 목차의 인덱스로 바꾼다.
 * 인덱스 하나면 활성 표시와 전환 방향이 둘 다 나온다.
 */
export function docsIndexOf(segment: string | null): number {
  const href = segment === null ? "/docs" : `/docs/${segment}`;
  return DOCS_PAGES.findIndex((page) => page.href === href);
}
