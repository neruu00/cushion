/**
 * @file lib/notification.test.ts
 * @description 알림 메시지 조립. 링크가 열리는지와 묶는 규칙이 맞는지.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { buildNotification, type PendingEvent } from "./notification.ts";

const BASE = "https://cushion.example.com";

function edit(path: string, summary: string, author = "a@x.com"): PendingEvent {
  return { author, changed_paths: [path], deleted_paths: [], summary };
}

function removal(path: string, author = "a@x.com"): PendingEvent {
  return { author, changed_paths: [], deleted_paths: [path], summary: `삭제: ${path}\n— ${author}` };
}

test("보낼 게 없으면 null — 빈 알림을 쏘지 않는다", () => {
  assert.equal(buildNotification({ base: BASE, slug: "cushion", events: [] }), null);
});

test("한 건이면 저장된 요약 두 줄을 그대로 쓰고 경로만 링크가 된다", () => {
  const text = buildNotification({
    base: BASE,
    slug: "cushion",
    events: [edit("PLAN.md", 'PLAN.md — 4. 다음 작업 (+12 −3)\n"T-503 완료" — a@x.com')],
  });

  assert.ok(text);
  // 요약 문자열을 다시 만들지 않는다 — 섹션과 증감이 그대로 살아 있어야 한다
  assert.match(text, /4\. 다음 작업 \(\+12 −3\)/);
  assert.match(text, /"T-503 완료" — a@x\.com/);
  assert.ok(text.includes(`[PLAN.md](${BASE}/libraries/cushion/PLAN.md)`));
  assert.ok(text.includes(`[cushion](${BASE}/libraries/cushion)`));
  // 한 건일 때만 이력 링크가 붙는다 — 여러 건이면 어느 이력인지 고를 수 없다
  assert.ok(text.includes(`[이력](${BASE}/libraries/cushion/history/PLAN.md)`));
  assert.ok(text.includes(`[변경 목록](${BASE}/libraries/cushion/changes)`));
  // 한 건에는 건수를 붙이지 않는다
  assert.doesNotMatch(text, /변경 1건/);
});

test("삭제는 보기 화면이 404다 — 이력으로 보낸다", () => {
  const text = buildNotification({ base: BASE, slug: "cushion", events: [removal("OLD.md")] });
  assert.ok(text);
  assert.ok(text.includes(`[OLD.md](${BASE}/libraries/cushion/history/OLD.md)`));
  assert.ok(!text.includes(`[OLD.md](${BASE}/libraries/cushion/OLD.md)`));
});

test("세 건까지는 펼친다 — 각 편집의 요약이 다 남는다", () => {
  const text = buildNotification({
    base: BASE,
    slug: "cushion",
    events: [
      edit("PLAN.md", "PLAN.md — 4. 다음 작업 (+2 −1)\n— a@x.com"),
      edit("SPEC.md", "SPEC.md — 9. 화면 (+3 −0)\n— b@x.com"),
    ],
  });

  assert.ok(text);
  assert.match(text, /4\. 다음 작업/);
  assert.match(text, /9\. 화면/);
  assert.match(text, /변경 2건/);
  // 펼친 모드에는 ×n 접기가 없다
  assert.doesNotMatch(text, /×\d/);
});

test("네 건부터 문서별로 접는다 — 같은 문서가 한 줄로 합쳐진다", () => {
  const events = [
    ...Array.from({ length: 5 }, (_, i) => edit("PLAN.md", `PLAN.md — §${i} (+1 −0)`)),
    edit("SPEC.md", "SPEC.md — 9. 화면 (+1 −0)", "b@x.com"),
  ];
  const text = buildNotification({ base: BASE, slug: "cushion", events });

  assert.ok(text);
  assert.match(text, /변경 6건/);
  assert.ok(text.includes(`[PLAN.md](${BASE}/libraries/cushion/PLAN.md) ×5`));
  // 한 번만 고친 문서에는 ×1을 붙이지 않는다
  assert.ok(text.includes(`[SPEC.md](${BASE}/libraries/cushion/SPEC.md)\n`));
  assert.doesNotMatch(text, /×1\b/);
  // 많이 고쳐진 문서가 위로
  assert.ok(text.indexOf("PLAN.md") < text.indexOf("SPEC.md"));
  // 작성자는 한 줄로 모인다
  assert.match(text, /a@x\.com, b@x\.com/);
});

test("지웠다 다시 만든 경로는 🗑가 아니다 — 마지막 상태를 따른다", () => {
  const events = [
    removal("A.md"),
    edit("A.md", "A.md 새 문서 (+10)"),
    edit("B.md", "B.md — x (+1 −0)"),
    removal("C.md"),
  ];
  const text = buildNotification({ base: BASE, slug: "cushion", events });

  assert.ok(text);
  assert.ok(text.includes(`🗑 [C.md](${BASE}/libraries/cushion/history/C.md)`));
  assert.ok(text.includes(`[A.md](${BASE}/libraries/cushion/A.md)`));
  assert.ok(!text.includes("🗑 [A.md]"));
});

test("문서가 많으면 끊고 남은 개수를 적는다", () => {
  const events = Array.from({ length: 12 }, (_, i) => edit(`doc-${i}.md`, `doc-${i}.md — x (+1 −0)`));
  const text = buildNotification({ base: BASE, slug: "cushion", events });

  assert.ok(text);
  assert.match(text, /…외 4개 문서/);
});

test("창 밖으로 밀린 건수를 감추지 않는다", () => {
  const text = buildNotification({
    base: BASE,
    slug: "cushion",
    events: [edit("PLAN.md", "PLAN.md — x (+1 −0)")],
    total: 40,
  });

  assert.ok(text);
  assert.match(text, /변경 40건/);
  assert.match(text, /…외 39건/);
});

test("경로에 하위 폴더와 공백이 있어도 링크가 깨지지 않는다", () => {
  const text = buildNotification({
    base: BASE,
    slug: "cushion",
    events: [edit("adr/0001 초안.md", "adr/0001 초안.md — x (+1 −0)")],
  });

  assert.ok(text);
  // '/'는 세그먼트 구분이라 살아야 하고, 공백만 인코딩돼야 한다
  assert.ok(text.includes(`${BASE}/libraries/cushion/adr/0001%20%EC%B4%88%EC%95%88.md`));
  assert.ok(!text.includes("adr%2F"));
});

test("요약이 없어도 터지지 않는다", () => {
  const text = buildNotification({
    base: BASE,
    slug: "cushion",
    events: [{ author: null, changed_paths: ["X.md"], deleted_paths: [], summary: null }],
  });
  assert.ok(text);
  assert.match(text, /X\.md/);
});
