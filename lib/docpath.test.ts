/**
 * @file lib/docpath.test.ts
 * @description 디렉터리 트리 검증. 여기가 틀리면 문서가 목록에서 사라진다 —
 * 원본이 Cushion이라(D-011) "안 보이는 문서"는 "없는 문서"로 읽힌다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

// `@/` 별칭이 아니라 확장자까지 쓴 상대 경로다. plain Node는 tsconfig의 paths를 모른다 (D-008).
import { baseNameOf, breadcrumbs, buildTree, dirOf } from "./docpath.ts";

/**
 * SQL이 `order("path")`로 주는 순서를 손으로 적었다 — `localeCompare`로 정렬하면
 * 대소문자 순서가 ICU 로케일 데이터에 딸려 가 테스트가 환경에 따라 흔들린다.
 * 여기서 중요한 건 정렬 규칙이 아니라 **입력 순서가 보존되는가**다.
 */
const DOCS = [
  { path: "PLAN.md" },
  { path: "SPEC.md" },
  { path: "adr.md" },
  { path: "adr/0001-mcp.md" },
  { path: "adr/0002-token.md" },
  { path: "adr/2026/0007-rotation.md" },
  { path: "runbook/deploy.md" },
];

test("루트에 문서와 디렉터리가 갈라져 담긴다", () => {
  const tree = buildTree(DOCS);

  assert.deepEqual(
    tree.docs.map((entry) => entry.name),
    ["PLAN.md", "SPEC.md", "adr.md"],
  );
  assert.deepEqual(
    tree.dirs.map((dir) => [dir.name, dir.path, dir.count]),
    [
      // 3 = 0001 + 0002 + 2026/0007. 재귀로 센다
      ["adr", "adr", 3],
      ["runbook", "runbook", 1],
    ],
  );
});

test("`adr.md`가 `adr/`에 딸려 들어가지 않는다", () => {
  const tree = buildTree(DOCS);
  const adr = tree.dirs.find((dir) => dir.name === "adr");

  assert.ok(adr);
  assert.deepEqual(
    adr.docs.map((entry) => entry.name),
    ["0001-mcp.md", "0002-token.md"],
  );
  // 세그먼트로 갈라야 한다 — 문자열 접두사로 비교하면 `adr.md`가 여기 섞인다
  assert.ok(tree.docs.some((entry) => entry.doc.path === "adr.md"));
});

test("깊이 제한이 없다 — 디렉터리 안 디렉터리가 그대로 트리로 남는다", () => {
  const deep = buildTree([{ path: "a/b/c/d.md" }]);

  const a = deep.dirs[0];
  assert.deepEqual([a.name, a.path, a.count, a.docs.length], ["a", "a", 1, 0]);

  const b = a.dirs[0];
  assert.deepEqual([b.name, b.path, b.count], ["b", "a/b", 1]);

  const c = b.dirs[0];
  assert.deepEqual([c.name, c.path, c.count], ["c", "a/b/c", 1]);
  assert.deepEqual(
    c.docs.map((entry) => entry.name),
    ["d.md"],
  );
  assert.deepEqual(c.dirs, []);
});

test("같은 디렉터리를 두 번 만들지 않는다", () => {
  const tree = buildTree([
    { path: "adr/0001.md" },
    { path: "adr/2026/a.md" },
    { path: "adr/0002.md" },
    { path: "adr/2026/b.md" },
  ]);

  assert.equal(tree.dirs.length, 1);
  assert.equal(tree.dirs[0].count, 4);
  assert.equal(tree.dirs[0].dirs.length, 1);
  assert.equal(tree.dirs[0].dirs[0].count, 2);
});

test("디렉터리는 이름순, 문서는 입력 순서 그대로", () => {
  const tree = buildTree([
    { path: "b.md" },
    { path: "a.md" },
    { path: "runbook/x.md" },
    { path: "adr/y.md" },
  ]);

  assert.deepEqual(
    tree.docs.map((entry) => entry.name),
    ["b.md", "a.md"],
  );
  assert.deepEqual(
    tree.dirs.map((dir) => dir.name),
    ["adr", "runbook"],
  );
});

test("빈 목록은 빈 트리", () => {
  assert.deepEqual(buildTree([]), { dirs: [], docs: [] });
});

test("브레드크럼은 단계마다 그 그룹의 경로를 준다", () => {
  assert.deepEqual(breadcrumbs("adr/2026"), [
    { name: "adr", path: "adr" },
    { name: "2026", path: "adr/2026" },
  ]);
  assert.deepEqual(breadcrumbs(""), []);
  assert.deepEqual(breadcrumbs("/adr/"), [{ name: "adr", path: "adr" }]);
});

test("경로를 디렉터리와 파일명으로 쪼갠다", () => {
  assert.equal(dirOf("adr/2026/0007-rotation.md"), "adr/2026");
  assert.equal(dirOf("SPEC.md"), "");
  assert.equal(baseNameOf("adr/2026/0007-rotation.md"), "0007-rotation.md");
  assert.equal(baseNameOf("SPEC.md"), "SPEC.md");
});
