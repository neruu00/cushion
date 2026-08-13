/**
 * @file lib/token.test.ts
 * @description 토큰 종류 분리와 평문 미저장에 대한 최소 검증. `pnpm test`.
 *
 * `./token.ts` 확장자까지 쓰는 이유: node --test가 타입 스트리핑으로 직접 실행하므로
 * `@/` 별칭도, 확장자 생략도 해석하지 못한다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { generateToken, hashFromAuthHeader, sha256, TOKEN_PREFIX } from "./token.ts";

test("발급 토큰은 종류별 접두사를 갖고, 해시는 평문에서만 나온다", () => {
  const pat = generateToken("access");
  const sync = generateToken("sync");

  assert.ok(pat.plaintext.startsWith(TOKEN_PREFIX.access));
  assert.ok(sync.plaintext.startsWith(TOKEN_PREFIX.sync));
  assert.equal(pat.hash, sha256(pat.plaintext));
  assert.notEqual(pat.plaintext, sync.plaintext);
  assert.notEqual(pat.hash, pat.plaintext);
});

test("종류가 다른 토큰은 거부한다 — sync 토큰으로 access 경로를 못 탄다", () => {
  const sync = generateToken("sync");
  const pat = generateToken("access");

  assert.equal(hashFromAuthHeader(`Bearer ${sync.plaintext}`, "access"), null);
  assert.equal(hashFromAuthHeader(`Bearer ${pat.plaintext}`, "sync"), null);

  assert.equal(hashFromAuthHeader(`Bearer ${sync.plaintext}`, "sync"), sync.hash);
  assert.equal(hashFromAuthHeader(`Bearer ${pat.plaintext}`, "access"), pat.hash);
});

test("Bearer 형식이 아니면 거부한다", () => {
  const pat = generateToken("access");

  assert.equal(hashFromAuthHeader(null, "access"), null);
  assert.equal(hashFromAuthHeader(undefined, "access"), null);
  assert.equal(hashFromAuthHeader("", "access"), null);
  assert.equal(hashFromAuthHeader(pat.plaintext, "access"), null);
  assert.equal(hashFromAuthHeader(`bearer ${pat.plaintext}`, "access"), null);
});
