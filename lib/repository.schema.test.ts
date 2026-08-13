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

test("GitHub은 클론 URL을 붙여넣어도 org/repo로 접힌다", () => {
  const of = (github_full_name: string) =>
    createRepositorySchema.safeParse({ slug: "x", name: "n", github_full_name });

  for (const input of [
    "https://github.com/neruu00/cushion.git",
    "https://github.com/neruu00/cushion",
    "http://www.github.com/neruu00/cushion/",
    "neruu00/cushion",
  ]) {
    const parsed = of(input);
    assert.ok(parsed.success, `허용돼야 한다: ${input}`);
    assert.equal(parsed.data.github_full_name, "neruu00/cushion");
  }

  // 접고 나서도 org/repo가 아니면 거부한다 — 그래야 원본 링크가 깨지지 않는다
  assert.equal(of("neruu00").success, false);
  assert.equal(of("https://gitlab.com/a/b").success, false);
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

test("웹훅은 URL 형태만 받는다", () => {
  // 틀린 값은 저장할 땐 조용하고, 알림 보낼 때 서버 로그에만 실패가 남는다 — 그때는 아무도 모른다
  const bad = createRepositorySchema.safeParse({
    slug: "a",
    name: "A",
    discord_webhook_url: "discord.com/api/webhooks/1",
  });
  assert.equal(bad.success, false);

  const ok = createRepositorySchema.safeParse({
    slug: "a",
    name: "A",
    mattermost_webhook_url: "https://mm.example.com/hooks/xyz",
    discord_webhook_url: "https://discord.com/api/webhooks/1/abc",
  });
  assert.ok(ok.success);
  assert.equal(ok.data.discord_webhook_url, "https://discord.com/api/webhooks/1/abc");
});

test("웹훅 빈 칸은 null — DB에 ''를 넣지 않는다", () => {
  const parsed = createRepositorySchema.safeParse({ slug: "a", name: "A", discord_webhook_url: "  " });

  assert.ok(parsed.success);
  assert.equal(parsed.data.discord_webhook_url, null);
});
