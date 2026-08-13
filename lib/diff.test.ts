/**
 * @file lib/diff.test.ts
 * @description diff 검증. 이력 화면이 "무엇으로 되돌리는지"를 보여주는 근거라
 *              여기가 틀리면 되돌리기가 눈감고 하는 일이 된다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { countChanges, diffLines, toHunks } from "./diff.ts";

const render = (before: string, after: string) =>
  (diffLines(before, after) ?? []).map((l) => `${l.kind}${l.text}`);

test("같은 문서면 변경이 없다", () => {
  const doc = "# 제목\n\n본문.\n";
  const lines = diffLines(doc, doc);

  assert.ok(lines);
  assert.deepEqual(countChanges(lines), { added: 0, removed: 0 });
  assert.ok(lines.every((l) => l.kind === " "));
});

test("한 줄 수정은 -와 + 한 쌍이다", () => {
  assert.deepEqual(render("a\nb\nc", "a\nB\nc"), [" a", "-b", "+B", " c"]);
});

test("순수 삽입 · 순수 삭제", () => {
  assert.deepEqual(render("a\nc", "a\nb\nc"), [" a", "+b", " c"]);
  assert.deepEqual(render("a\nb\nc", "a\nc"), [" a", "-b", " c"]);
});

test("삭제된 줄에는 after 줄 번호가 없다", () => {
  const lines = diffLines("a\nb\nc", "a\nc") ?? [];
  const removed = lines.find((l) => l.kind === "-");

  assert.equal(removed?.afterLine, null);
  assert.equal(lines.find((l) => l.text === "c")?.afterLine, 2);
});

test("CRLF 문서도 같은 결과", () => {
  // 이 프로젝트에서 이미 두 번 물린 자리다.
  assert.deepEqual(render("a\r\nb\r\nc", "a\r\nB\r\nc"), [" a", "-b", "+B", " c"]);
  assert.deepEqual(render("a\nb\nc", "a\r\nB\r\nc"), [" a", "-b", "+B", " c"]);
});

test("긴 문서에서 가운데 한 줄만 바뀌면 hunk 하나에 context 3줄씩", () => {
  const before = Array.from({ length: 200 }, (_, i) => `줄 ${i}`);
  const after = [...before];
  after[100] = "고친 줄";

  const lines = diffLines(before.join("\n"), after.join("\n"));
  assert.ok(lines);

  const hunks = toHunks(lines, after.join("\n"));
  assert.equal(hunks.length, 1);
  // context 3 + '-' + '+' + context 3
  assert.deepEqual(
    hunks[0].lines.map((l) => `${l.kind}${l.text}`),
    ["  줄 97", "  줄 98", "  줄 99", "-줄 100", "+고친 줄", "  줄 101", "  줄 102", "  줄 103"].map(
      (s) => s.replace("  ", " "),
    ),
  );
});

test("떨어진 변경 둘은 hunk 둘로 갈린다", () => {
  const before = Array.from({ length: 100 }, (_, i) => `줄 ${i}`);
  const after = [...before];
  after[10] = "위";
  after[80] = "아래";

  const lines = diffLines(before.join("\n"), after.join("\n"));
  assert.equal(toHunks(lines ?? [], after.join("\n")).length, 2);
});

test("hunk 머리에 감싸는 ## 섹션이 붙는다", () => {
  const before = ["# 스펙", "", "머리말", "", "## 인증", "", "30일", "", "## 댓글", "", "1단계"].join("\n");
  const after = before.replace("30일", "7일");

  const hunks = toHunks(diffLines(before, after) ?? [], after);
  assert.equal(hunks.length, 1);
  assert.equal(hunks[0].heading, "인증");
});

test("첫 ## 앞의 변경은 감쌀 섹션이 없다", () => {
  const before = ["# 스펙", "", "머리말", "", "## 인증", "", "30일"].join("\n");
  const after = before.replace("머리말", "머리말을 고쳤다");

  assert.equal(toHunks(diffLines(before, after) ?? [], after)[0].heading, null);
});

test("전면 재작성은 상한에 걸려 null — 그때는 전문이 낫다", () => {
  const a = Array.from({ length: 2500 }, (_, i) => `옛 ${i}`).join("\n");
  const b = Array.from({ length: 2500 }, (_, i) => `새 ${i}`).join("\n");

  assert.equal(diffLines(a, b), null);
  // 접두·접미가 같으면 같은 크기라도 통과한다 — 보통의 편집이 그렇다
  assert.ok(diffLines(`${a}\n꼬리`, `${a}\n다른 꼬리`));
});

test("빈 문서 ↔ 내용 (생성·삭제)", () => {
  assert.deepEqual(countChanges(diffLines("", "a\nb") ?? []), { added: 2, removed: 1 });
  assert.deepEqual(countChanges(diffLines("a\nb", "") ?? []), { added: 1, removed: 2 });
});
