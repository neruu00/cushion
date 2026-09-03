/**
 * @file lib/docpath.ts
 * @description 문서 경로(`adr/0007-x.md`)를 디렉터리 트리로 접는다.
 *
 * **디렉터리는 실체가 없다.** `documents`에는 문서 행만 있고 디렉터리 행이 없으므로
 * 여기서 말하는 디렉터리는 경로에서 읽어낸 것뿐이다 — 그래서 빈 디렉터리는 존재할 수 없고,
 * 마지막 문서를 지우면 그 디렉터리도 같이 사라진다. 따로 정리할 게 없다는 뜻이다.
 *
 * 접는 걸 라우트가 아니라 여기서 하는 이유: 목록 화면이 이미 문서 전부를 읽어오므로
 * (절약 추정 때문에) 트리를 만드는 데 추가 조회가 없다. 게다가 문서 라우트가 catch-all이라
 * `/libraries/x/adr`을 주소로 만들면 그게 문서인지 디렉터리인지 DB를 봐야 갈린다 —
 * 라우팅이 `.md` 확장자에 매달리게 된다.
 *
 * 순수 함수만 둔다 — DB도 fetch도 없다. `node --test`가 직접 실행한다 (D-008).
 */

/** 트리의 문서 하나 */
export interface DocNode<T> {
  doc: T;
  /** 마지막 세그먼트. 앞의 디렉터리는 그룹 헤더가 들고 있으므로 줄에서는 뺀다 */
  name: string;
}

/** 한 디렉터리의 내용. 루트도 같은 모양이다 */
export interface DirContents<T> {
  dirs: DirNode<T>[];
  docs: DocNode<T>[];
}

export interface DirNode<T> extends DirContents<T> {
  name: string;
  /** 루트 기준 전체 경로. 화면이 앵커(`#dir-…`)로 쓴다 */
  path: string;
  /** 하위 전체 문서 수(재귀). 직속만 세면 중간 디렉터리가 0으로 보여 빈 폴더로 읽힌다 */
  count: number;
}

/**
 * 경로 목록을 트리로. 디렉터리는 각 단계에서 이름순, **문서는 입력 순서 그대로**다 —
 * 호출부의 SQL이 이미 `path`로 정렬했고, 여기서 다시 정렬하면 기준이 두 곳으로 갈린다.
 */
export function buildTree<T extends { path: string }>(docs: T[]): DirContents<T> {
  const root: DirContents<T> = { dirs: [], docs: [] };
  // 같은 디렉터리를 두 번 만들지 않으려면 경로로 찾을 수단이 필요하다
  const byPath = new Map<string, DirNode<T>>();

  for (const doc of docs) {
    const segments = doc.path.split("/").filter((segment) => segment !== "");
    if (segments.length === 0) continue;

    const name = segments.pop() as string;

    let parent = root;
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix === "" ? segment : `${prefix}/${segment}`;

      let node = byPath.get(prefix);
      if (!node) {
        node = { name: segment, path: prefix, count: 0, dirs: [], docs: [] };
        byPath.set(prefix, node);
        parent.dirs.push(node);
      }
      // 지나가는 조상 전부를 센다 — 세면서 내려가면 나중에 트리를 다시 훑지 않아도 된다
      node.count += 1;
      parent = node;
    }

    parent.docs.push({ doc, name });
  }

  sortDirs(root);
  return root;
}

function sortDirs<T>(node: DirContents<T>): void {
  node.dirs.sort((a, b) => a.name.localeCompare(b.name));
  for (const dir of node.dirs) sortDirs(dir);
}

/**
 * `"adr/2026"` → `adr`, `adr/2026`. 루트는 빈 배열.
 * 문서 화면의 브레드크럼이 단계마다 목록의 그 그룹을 가리키는 데 쓴다.
 */
export function breadcrumbs(dir: string): { name: string; path: string }[] {
  const segments = dir.split("/").filter((segment) => segment !== "");

  return segments.map((name, index) => ({
    name,
    path: segments.slice(0, index + 1).join("/"),
  }));
}

/** 문서 경로에서 디렉터리 부분만. `SPEC.md` → `""`, `adr/0007-x.md` → `"adr"` */
export function dirOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

/** 문서 경로의 파일명. `adr/0007-x.md` → `"0007-x.md"` */
export function baseNameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
