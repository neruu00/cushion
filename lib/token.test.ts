/**
 * @file lib/token.test.ts
 * @description 평문 미저장과 접두사 검사에 대한 최소 검증. `pnpm test`.
 *
 * `./token.ts` 확장자까지 쓰는 이유: node --test가 타입 스트리핑으로 직접 실행하므로
 * `@/` 별칭도, 확장자 생략도 해석하지 못한다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { generateToken, hashFromAuthHeader, sha256, TOKEN_PREFIX } from "./token.ts";

test("발급 토큰은 접두사를 갖고, 해시는 평문에서만 나온다", () => {
  const a = generateToken("access");
  const b = generateToken("access");

  assert.ok(a.plaintext.startsWith(TOKEN_PREFIX.access));
  assert.equal(a.hash, sha256(a.plaintext));
  assert.notEqual(a.plaintext, b.plaintext);
  assert.notEqual(a.hash, a.plaintext);
});

test("접두사가 다르면 해시조차 뜨지 않는다", () => {
  const pat = generateToken("access");

  assert.equal(hashFromAuthHeader(`Bearer ${pat.plaintext}`, "access"), pat.hash);
  // 남의 시스템 키를 실수로 보낸 경우 — DB를 두드리기 전에 걸러야 한다
  assert.equal(hashFromAuthHeader("Bearer ghp_1234567890", "access"), null);
  assert.equal(hashFromAuthHeader("Bearer cshn_sync_legacy", "access"), null);
});

test("Bearer 형식이 아니면 거부한다", () => {
  const pat = generateToken("access");

  assert.equal(hashFromAuthHeader(null, "access"), null);
  assert.equal(hashFromAuthHeader(undefined, "access"), null);
  assert.equal(hashFromAuthHeader("", "access"), null);
  assert.equal(hashFromAuthHeader(pat.plaintext, "access"), null);
  assert.equal(hashFromAuthHeader(`bearer ${pat.plaintext}`, "access"), null);
});
