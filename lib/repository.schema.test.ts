/**
 * @file lib/repository.schema.test.ts
 * @description 폼 검증 중 권한과 직결되는 두 가지만 본다: slug 형식, 이메일 lowercase 정규화.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { createRepositorySchema, memberSchema } from "./repository.schema.ts";

test("이메일은 저장 전에 lowercase가 된다 — 대소문자 차이는 ACL 우회 구멍이다", () => {
  const parsed = memberSchema.safeParse({
    repository_id: "00000000-0000-4000-8000-000000000000",
    email: "  Teammate@Example.COM ",
  });

  assert.ok(parsed.success);
  assert.equal(parsed.data.email, "teammate@example.com");
});

test("slug는 DB CHECK와 같은 규칙으로 걸러진다", () => {
  const ok = ["cushion", "a", "my-repo-2"];
  const no = ["-lead", "UPPER", "with space", "under_score", ""];

  for (const slug of ok) {
    assert.ok(
      createRepositorySchema.safeParse({ slug, name: "n" }).success,
      `허용돼야 한다: ${slug}`,
    );
  }
  for (const slug of no) {
    assert.equal(
      createRepositorySchema.safeParse({ slug, name: "n" }).success,
      false,
      `거부돼야 한다: ${slug}`,
    );
  }
});

test("비워둔 optional 입력은 ''가 아니라 null로 간다", () => {
  const parsed = createRepositorySchema.safeParse({
    slug: "cushion",
    name: "Cushion",
    github_full_name: "",
    mattermost_webhook_url: "  ",
  });

  assert.ok(parsed.success);
  assert.equal(parsed.data.github_full_name, null);
  assert.equal(parsed.data.mattermost_webhook_url, null);
});
