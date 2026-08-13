/**
 * @file lib/summary.test.ts
 * @description 요약 생성기 검증. diff 파싱이 틀리면 알림도 델타도 같이 틀어진다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSummary,
  changedHeadings,
  documentTitle,
  notificationText,
  parseDiff,
} from "./summary.ts";

const FEATURES = [
  "# 기능", // 1
  "", // 2
  "## 인증", // 3
  "", // 4
  "a", // 5
  "b", // 6
  "c", // 7
  "기존 줄", // 8
  "새 내용", // 9
  "또 한 줄", // 10
  "", // 11
  "## 댓글", // 12
  "손대지 않았다", // 13
].join("\n");

const DIFF = [
  "diff --git a/.specs/features.md b/.specs/features.md",
  "index 1111111..2222222 100644",
  "--- a/.specs/features.md",
  "+++ b/.specs/features.md",
  "@@ -8,3 +8,4 @@",
  " 기존 줄",
  "-옛 내용",
  "----",
  "+새 내용",
  "+또 한 줄",
  "diff --git a/.specs/editor.md b/.specs/editor.md",
  "deleted file mode 100644",
  "index 3333333..0000000",
  "--- a/.specs/editor.md",
  "+++ /dev/null",
  "@@ -1,2 +0,0 @@",
  "-# 에디터",
  "-내용",
].join("\n");

test("hunk 안의 ---- 를 헤더로 오인하지 않는다", () => {
  const stats = parseDiff(DIFF);
  const features = stats.get(".specs/features.md");

  assert.ok(features);
  assert.equal(features.added, 2);
  assert.equal(features.removed, 2); // '옛 내용' + 마크다운 구분선 '---'
  assert.deepEqual(features.hunkStarts, [8]);
});

test("삭제된 파일은 +++ 가 /dev/null이라 --- 쪽 경로로 잡는다", () => {
  const editor = parseDiff(DIFF).get(".specs/editor.md");

  assert.ok(editor);
  assert.equal(editor.added, 0);
  assert.equal(editor.removed, 2);
});

test("hunk 위치를 감싸는 ## 섹션을 되짚는다", () => {
  assert.deepEqual(changedHeadings(FEATURES, [8]), ["인증"]);
  assert.deepEqual(changedHeadings(FEATURES, [13]), ["댓글"]);
  assert.deepEqual(changedHeadings(FEATURES, [8, 13]), ["인증", "댓글"]);
  // 첫 ## 앞의 변경은 걸칠 섹션이 없다
  assert.deepEqual(changedHeadings(FEATURES, [1]), []);
});

test("제목은 첫 # 헤딩. ## 은 제목이 아니다", () => {
  assert.equal(documentTitle(FEATURES), "기능");
  assert.equal(documentTitle("## 소제목만 있다"), null);
  assert.equal(documentTitle("본문뿐"), null);
});

test("요약은 경로 + 바뀐 헤딩 + 증감 + 커밋 + 링크", () => {
  const summary = buildSummary({
    changed: [{ path: ".specs/features.md", content: FEATURES }],
    deleted: [".specs/editor.md"],
    diff: DIFF,
    commit: { sha: "abc123", author: "neruu00", message: "세션 만료 정책 변경\n\n본문은 버린다" },
    truncated: false,
    githubFullName: "neruu00/cushion",
  });

  assert.deepEqual(summary.split("\n"), [
    ".specs/features.md — 인증 (+2 −2)",
    "삭제: .specs/editor.md",
    '"세션 만료 정책 변경" — neruu00',
    "https://github.com/neruu00/cushion/commit/abc123",
  ]);
});

test("파일이 많으면 목록을 끊고 남은 건수를 적는다", () => {
  const changed = Array.from({ length: 13 }, (_, i) => ({ path: `.specs/${i}.md`, content: "" }));
  const summary = buildSummary({
    changed,
    deleted: [],
    diff: "",
    commit: { sha: "", author: "", message: "" },
    truncated: false,
    githubFullName: null,
  });

  assert.equal(summary.split("\n").length, 11);
  assert.ok(summary.endsWith("외 3건"));
});

test("짧은 diff는 알림에 붙이고 긴 diff는 버린다", () => {
  assert.ok(notificationText("요약", DIFF).includes("```diff"));
  assert.equal(notificationText("요약", ""), "요약");

  const long = Array.from({ length: 41 }, (_, i) => `+줄 ${i}`).join("\n");
  assert.equal(notificationText("요약", long), "요약");
});
