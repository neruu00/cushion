/**
 * @file lib/frontmatter.test.ts
 * @description 앞머리를 잘못 떼면 문서 화면에 `---`와 메타데이터가 본문으로 새어 나온다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { splitFrontmatter } from "./frontmatter.ts";
import { readSkills } from "./skills.ts";

test("name·description을 떼어내고 본문만 남긴다", () => {
  const { data, body } = splitFrontmatter(
    "---\nname: cushion\ndescription: 문서를 읽고 쓴다\n---\n\n# 제목\n본문\n",
  );

  assert.equal(data.name, "cushion");
  assert.equal(data.description, "문서를 읽고 쓴다");
  assert.ok(body.startsWith("\n# 제목"));
  assert.ok(!body.includes("---"));
});

test("description 안의 콜론을 자르지 않는다", () => {
  // 스킬 설명에는 `/cushion-use [slug] 로 부를 때만` 같은 문장이 들어간다.
  // 콜론마다 자르면 값이 잘려 카드에 반 토막이 뜬다.
  const { data } = splitFrontmatter("---\ndescription: 이럴 때: 저럴 때\n---\n본문\n");

  assert.equal(data.description, "이럴 때: 저럴 때");
});

test("앞머리가 없으면 원문 그대로 돌려준다", () => {
  const source = "# 제목만 있는 문서\n";
  const { data, body } = splitFrontmatter(source);

  assert.deepEqual(data, {});
  assert.equal(body, source);
});

test("실제 스킬 파일 전부에서 name·description이 나온다", () => {
  // 문서 화면이 이 둘로 카드를 그린다. 하나라도 비면 빈 카드가 된다.
  const { files } = readSkills();
  assert.ok(files.length > 0);

  for (const file of files) {
    const { data, body } = splitFrontmatter(file.content);
    assert.ok(data.name, `${file.path}: name 없음`);
    assert.ok(data.description, `${file.path}: description 없음`);
    assert.ok(body.trim().length > 0, `${file.path}: 본문 없음`);
  }
});
