/**
 * @file lib/spec.test.ts
 * @description 섹션 분할·검색 검증. 여기가 틀리면 MCP 툴의 절감이 통째로 어긋난다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { findSection, headings, scoreSection, snippet, splitSections } from "./spec.ts";

const DOC = [
  "# 기능",
  "",
  "머리말이다.",
  "",
  "## 인증",
  "",
  "세션은 30일이다.",
  "",
  "## 댓글",
  "",
  "### 대댓글", // ### 는 섹션 경계가 아니다
  "깊이는 1단계.",
].join("\n");

test("## 만 섹션 경계다. 머리말은 heading null", () => {
  const sections = splitSections(DOC);

  assert.deepEqual(
    sections.map((s) => s.heading),
    [null, "인증", "댓글"],
  );
  assert.ok(sections[0].text.startsWith("# 기능"));
  assert.ok(sections[2].text.includes("### 대댓글"));
});

test("헤딩 목록이 outline의 전부다", () => {
  assert.deepEqual(headings(DOC), ["인증", "댓글"]);
  assert.deepEqual(headings("본문뿐"), []);
});

test("섹션은 '## 인증'으로 주든 '인증'으로 주든 찾는다", () => {
  const wanted = "## 인증\n\n세션은 30일이다.";

  assert.equal(findSection(DOC, "인증"), wanted);
  assert.equal(findSection(DOC, "## 인증"), wanted);
  assert.equal(findSection(DOC, "  인증 "), wanted);
  assert.equal(findSection(DOC, "없는섹션"), null);
});

test("헤딩 매칭에 가중치를 준다", () => {
  const [, auth, comment] = splitSections(DOC);

  assert.ok(scoreSection(auth, "인증") > scoreSection(comment, "인증"));
  assert.equal(scoreSection(auth, "댓글"), 0);
  assert.equal(scoreSection(auth, "   "), 0);
});

test("스니펫은 매칭 주변만 자른다", () => {
  const long = `${"가".repeat(300)}세션만료${"나".repeat(300)}`;
  const cut = snippet(long, "세션만료");

  assert.ok(cut.includes("세션만료"));
  assert.ok(cut.length < 200);
  assert.ok(cut.startsWith("…") && cut.endsWith("…"));
});
