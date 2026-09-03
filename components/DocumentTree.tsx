/**
 * @file components/DocumentTree.tsx
 * @description 문서 목록을 디렉터리 단위 아코디언으로. 접는 규칙은 `lib/docpath.ts`다.
 *
 * **서버 컴포넌트다 — 클라이언트 JS가 0줄이다.** 여닫기를 `<details>`/`<summary>`에
 * 맡겼기 때문이다. shadcn의 Accordion(Base UI)을 쓰면 `'use client'`가 붙어 목록 전체가
 * 클라이언트 번들로 넘어간다 — `Markdown`이 읽기 화면에 에디터 런타임을 싣지 않는 것과
 * 같은 이유다. 목록은 누르는 것이 아니라 읽는 화면이다 (SPEC §9).
 *
 * **화면을 이동하지 않는다.** 그래서 라이브러리 전체가 한 화면에 남고 "그 문서가 어디
 * 있었지"에 스크롤로 답할 수 있다. 디렉터리를 주소로 만들지 않은 이유는 문서 라우트가
 * catch-all이라 `/libraries/x/adr`이 문서인지 디렉터리인지 DB를 봐야 갈리기 때문이다.
 *
 * 대가: 여닫은 상태가 URL에 없다(새로고침하면 기본값으로 돌아온다). 대신 그룹마다 `id`를
 * 달아 문서 화면의 브레드크럼이 `#dir-…`로 그 자리를 가리킨다.
 *
 * 기본은 **열림**이다. 문서 수십 개 규모에서 전부 접어 두면 목록을 보려고 한 번 더 눌러야
 * 한다 — 접기는 시끄러운 묶음을 치우는 수단이지 기본 상태가 아니다.
 */
import { ChevronRight } from "lucide-react";

import { RowCard } from "@/components/RowCard";
import { formatDate } from "@/lib/datetime";
import { buildTree, type DirNode, type DocNode } from "@/lib/docpath";

/** 목록이 실제로 그리는 것만. 본문은 절약 추정에만 쓰고 여기 오지 않는다 */
interface TreeDocument {
  path: string;
  title: string | null;
  updated_at: string;
}

interface DocumentTreeProps {
  librarySlug: string;
  documents: TreeDocument[];
}

export function DocumentTree({ librarySlug, documents }: DocumentTreeProps) {
  const tree = buildTree(documents);

  return (
    <div className="space-y-3">
      {/* 루트 문서가 먼저다 — `SPEC.md`·`PLAN.md`가 제일 많이 열리는데 접히는 묶음
          아래로 밀리면 매번 스크롤이 된다 */}
      <DocumentRows librarySlug={librarySlug} docs={tree.docs} />
      {tree.dirs.map((dir) => (
        <DirectoryGroup key={dir.path} librarySlug={librarySlug} dir={dir} />
      ))}
    </div>
  );
}

interface DocumentRowsProps {
  librarySlug: string;
  docs: DocNode<TreeDocument>[];
}

function DocumentRows({ librarySlug, docs }: DocumentRowsProps) {
  if (docs.length === 0) return null;

  return (
    <ul className="divide-y rounded-lg border bg-background">
      {docs.map(({ doc, name }) => (
        <li key={doc.path}>
          {/* 제목은 파일명만 — 디렉터리는 위의 그룹 헤더가 이미 들고 있다 */}
          <RowCard
            href={`/libraries/${librarySlug}/${doc.path}`}
            title={name}
            subtitle={doc.title}
            meta={formatDate(doc.updated_at)}
          />
        </li>
      ))}
    </ul>
  );
}

interface DirectoryGroupProps {
  librarySlug: string;
  dir: DirNode<TreeDocument>;
}

function DirectoryGroup({ librarySlug, dir }: DirectoryGroupProps) {
  return (
    // 중첩은 카드 안의 카드로 표현한다 — 깊이마다 여백 규칙을 따로 두지 않아도 된다
    <details id={`dir-${dir.path}`} open className="group scroll-mt-4 rounded-lg border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-3 py-2 hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
          <span className="truncate font-mono text-sm">{dir.name}/</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">문서 {dir.count}</span>
      </summary>
      <div className="space-y-2 border-t p-2">
        <DocumentRows librarySlug={librarySlug} docs={dir.docs} />
        {dir.dirs.map((child) => (
          <DirectoryGroup key={child.path} librarySlug={librarySlug} dir={child} />
        ))}
      </div>
    </details>
  );
}
