/**
 * @file lib/spec.test.ts
 * @description 섹션 분할·검색 검증. 여기가 틀리면 MCP 툴의 절감이 통째로 어긋난다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findSection,
  headings,
  replaceSection,
  scoreSection,
  snippet,
  splitSections,
} from "./markdown.ts";

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

test("CRLF 문서도 헤딩을 찾는다", () => {
  // Windows 체크아웃에서 온 문서. \r가 남으면 정규식 `.`가 그걸 못 먹어서
  // 목차가 통째로 비어 나온다 — 원인이 안 보이는 종류의 버그다.
  const crlf = DOC.replace(/\n/g, "\r\n");

  assert.deepEqual(headings(crlf), ["인증", "댓글"]);
  assert.equal(findSection(crlf, "인증"), "## 인증\n\n세션은 30일이다.");
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

test("replaceSection은 그 섹션만 바꾸고 나머지는 바이트 그대로 둔다", () => {
  const doc = ["# 기능", "", "머리말.", "", "## 인증", "", "30일.", "", "## 댓글", "", "1단계.", ""].join("\n");
  const out = replaceSection(doc, "인증", "## 인증\n\n7일.\n재로그인 필요.");

  assert.equal(
    out,
    ["# 기능", "", "머리말.", "", "## 인증", "", "7일.", "재로그인 필요.", "", "## 댓글", "", "1단계.", ""].join("\n"),
  );
  // 손대지 않은 부분이 흔들리면 sha가 흔들리고 이력 diff가 시끄러워진다
  assert.ok(out.startsWith("# 기능\n\n머리말.\n"));
  assert.ok(out.endsWith("## 댓글\n\n1단계.\n"));
});

test("replaceSection — 마지막 섹션, '## 인증'으로 주든 '인증'으로 주든", () => {
  const doc = "# 기능\n\n## 인증\n\n30일.\n\n## 댓글\n\n1단계.\n";
  const a = replaceSection(doc, "## 댓글", "## 댓글\n\n2단계.");
  const b = replaceSection(doc, "댓글", "## 댓글\n\n2단계.");

  assert.equal(a, b);
  assert.ok(a?.endsWith("## 댓글\n\n2단계.\n"));
});

test("replaceSection — 꼬리 줄바꿈이 제각각이어도 결과 sha가 같다", () => {
  const doc = "# 기능\n\n## 인증\n\n30일.\n\n## 댓글\n\n1단계.\n";

  const clean = replaceSection(doc, "인증", "## 인증\n\n7일.");
  assert.equal(replaceSection(doc, "인증", "## 인증\n\n7일.\n"), clean);
  assert.equal(replaceSection(doc, "인증", "## 인증\n\n7일.\n\n\n"), clean);
});

test("replaceSection — 없는 섹션이면 null, CRLF 문서도 동작", () => {
  const doc = "# 기능\r\n\r\n## 인증\r\n\r\n30일.\r\n";

  assert.equal(replaceSection(doc, "없는섹션", "## 없는섹션\n\nx"), null);
  assert.ok(replaceSection(doc, "인증", "## 인증\n\n7일.")?.includes("7일."));
});
