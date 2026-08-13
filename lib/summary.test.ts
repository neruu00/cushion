/**
 * @file lib/summary.test.ts
 * @description 편집 요약 검증. 여기가 틀리면 알림도 델타 피드도 같이 틀어진다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { changedSections, documentTitle, summarizeEdit } from "./summary.ts";

const BEFORE = [
  "# 기능",
  "",
  "머리말.",
  "",
  "## 인증",
  "",
  "세션은 30일이다.",
  "",
  "## 댓글",
  "",
  "대댓글은 1단계.",
].join("\n");

test("바뀐 섹션만 정확히 집는다", () => {
  const after = BEFORE.replace("세션은 30일이다.", "세션은 7일이다.");

  assert.deepEqual(changedSections(BEFORE, after), ["인증"]);
  assert.deepEqual(changedSections(BEFORE, BEFORE), []);
});

test("섹션 추가·삭제도 잡는다", () => {
  const added = `${BEFORE}\n\n## 알림\n\n이메일로 보낸다.`;
  const removed = BEFORE.split("## 댓글")[0].trimEnd();

  assert.deepEqual(changedSections(BEFORE, added), ["알림"]);
  assert.deepEqual(changedSections(BEFORE, removed), ["댓글"]);
});

test("머리말만 고치면 섹션 이름이 없다 — 대신 수치로 보인다", () => {
  const after = BEFORE.replace("머리말.", "머리말을 고쳤다.");

  assert.deepEqual(changedSections(BEFORE, after), []);
  assert.match(summarizeEdit({ path: "a.md", before: BEFORE, after, author: "n" }), /^a\.md \(\+1 −1\)/);
});

test("CRLF 문서도 같은 결과", () => {
  const crlf = BEFORE.replace(/\n/g, "\r\n");
  const after = crlf.replace("세션은 30일이다.", "세션은 7일이다.");

  assert.deepEqual(changedSections(crlf, after), ["인증"]);
  assert.equal(documentTitle(crlf), "기능");
});

test("옮겨 적기만 한 줄은 변경으로 세지 않는다", () => {
  // 섹션 순서를 바꿨을 뿐 내용은 그대로 — diff였다면 크게 잡혔을 자리다.
  const swapped = ["# 기능", "", "머리말.", "", "## 댓글", "", "대댓글은 1단계.", "", "## 인증", "", "세션은 30일이다."].join("\n");

  assert.match(summarizeEdit({ path: "a.md", before: BEFORE, after: swapped, author: "n" }), /\(\+0 −0\)/);
});

test("새 문서 · 수정 · 삭제의 첫 줄이 다르다", () => {
  const author = "neruu00";

  assert.match(
    summarizeEdit({ path: "a.md", before: null, after: BEFORE, author }),
    /^a\.md 새 문서 \(\+11\)/,
  );
  assert.match(
    summarizeEdit({ path: "a.md", before: BEFORE, after: null, author }),
    /^삭제: a\.md/,
  );
  assert.match(
    summarizeEdit({
      path: "a.md",
      before: BEFORE,
      after: BEFORE.replace("30일", "7일"),
      author,
      note: "세션 만료 정책 변경\n본문은 버린다",
    }),
    /^a\.md — 인증 \(\+1 −1\)\n"세션 만료 정책 변경" — neruu00$/,
  );
});

test("메모가 없으면 작성자만 남는다", () => {
  assert.match(
    summarizeEdit({ path: "a.md", before: null, after: "# x", author: "neruu00" }),
    /\n— neruu00$/,
  );
});

test("섹션이 많으면 끊고 남은 개수를 적는다", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => `## 섹션 ${i}\n\n내용 ${i}`).join("\n\n");
  const summary = summarizeEdit({
    path: "a.md",
    before: many(8),
    after: many(8).replace(/내용 \d/g, "바뀜"),
    author: "n",
  });

  assert.ok(summary.includes("외 3개"), summary);
});
