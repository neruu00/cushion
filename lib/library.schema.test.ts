/**
 * @file lib/library.schema.test.ts
 * @description 폼 검증 중 권한과 직결되는 두 가지만 본다: slug 형식, 이메일 lowercase 정규화.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { createLibrarySchema, matchesGithubRepo, memberSchema } from "./library.schema.ts";

test("이메일은 저장 전에 lowercase가 된다 — 대소문자 차이는 ACL 우회 구멍이다", () => {
  const parsed = memberSchema.safeParse({
    library_id: "00000000-0000-4000-8000-000000000000",
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
      createLibrarySchema.safeParse({ slug, name: "n" }).success,
      `허용돼야 한다: ${slug}`,
    );
  }
  for (const slug of no) {
    assert.equal(
      createLibrarySchema.safeParse({ slug, name: "n" }).success,
      false,
      `거부돼야 한다: ${slug}`,
    );
  }
});

test("GitHub은 클론 URL을 붙여넣어도 org/repo로 접힌다", () => {
  const of = (github_repos: string) =>
    createLibrarySchema.safeParse({ slug: "x", name: "n", github_repos });

  for (const input of [
    "https://github.com/neruu00/cushion.git",
    "https://github.com/neruu00/cushion",
    "http://www.github.com/neruu00/cushion/",
    "neruu00/cushion",
  ]) {
    const parsed = of(input);
    assert.ok(parsed.success, `허용돼야 한다: ${input}`);
    assert.deepEqual(parsed.data.github_repos, ["neruu00/cushion"]);
  }

  // 접고 나서도 org/repo가 아니면 거부한다 — 그래야 원본 링크가 깨지지 않는다
  assert.equal(of("neruu00").success, false);
  assert.equal(of("https://gitlab.com/a/b").success, false);
});

test("비워둔 optional 입력은 ''가 아니라 null로 간다", () => {
  const parsed = createLibrarySchema.safeParse({
    slug: "cushion",
    name: "Cushion",
    github_repos: "",
    mattermost_webhook_url: "  ",
  });

  assert.ok(parsed.success);
  assert.deepEqual(parsed.data.github_repos, []);
  assert.equal(parsed.data.mattermost_webhook_url, null);
});

test("웹훅은 URL 형태만 받는다", () => {
  // 틀린 값은 저장할 땐 조용하고, 알림 보낼 때 서버 로그에만 실패가 남는다 — 그때는 아무도 모른다
  const bad = createLibrarySchema.safeParse({
    slug: "a",
    name: "A",
    discord_webhook_url: "discord.com/api/webhooks/1",
  });
  assert.equal(bad.success, false);

  const ok = createLibrarySchema.safeParse({
    slug: "a",
    name: "A",
    mattermost_webhook_url: "https://mm.example.com/hooks/xyz",
    discord_webhook_url: "https://discord.com/api/webhooks/1/abc",
  });
  assert.ok(ok.success);
  assert.equal(ok.data.discord_webhook_url, "https://discord.com/api/webhooks/1/abc");
});

test("웹훅 빈 칸은 null — DB에 ''를 넣지 않는다", () => {
  const parsed = createLibrarySchema.safeParse({ slug: "a", name: "A", discord_webhook_url: "  " });

  assert.ok(parsed.success);
  assert.equal(parsed.data.discord_webhook_url, null);
});

test("여러 레포와 조직 와일드카드를 받는다", () => {
  // 조직이 라이브러리 하나를 공유하는 게 기본 시나리오다 — 단수였을 땐 하나를 임의로 골라야 했다
  const parsed = createLibrarySchema.safeParse({
    slug: "x",
    name: "n",
    github_repos: "acme/web, acme/api\nhttps://github.com/acme/docs.git acme/*",
  });

  assert.ok(parsed.success);
  assert.deepEqual(parsed.data.github_repos, ["acme/web", "acme/api", "acme/docs", "acme/*"]);
});

test("org/* 는 그 조직 전체와 일치한다", () => {
  assert.ok(matchesGithubRepo(["acme/*"], "acme/anything"));
  assert.ok(matchesGithubRepo(["acme/web"], "ACME/WEB"));
  assert.ok(!matchesGithubRepo(["acme/*"], "other/web"));
  assert.ok(!matchesGithubRepo(["acme/web"], "acme/api"));
});

test("형태가 아니면 거부", () => {
  assert.equal(createLibrarySchema.safeParse({ slug: "x", name: "n", github_repos: "acme" }).success, false);
});
