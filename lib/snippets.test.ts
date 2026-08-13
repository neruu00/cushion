/**
 * @file lib/snippets.test.ts
 * @description 연결 명령이 셸에 그대로 붙는 모양인지. 여기가 깨지면 온보딩이 통째로 막힌다.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { connectCommand } from "./snippets.ts";

test("연결 명령은 한 줄이다", () => {
  // 백슬래시 줄바꿈은 PowerShell·cmd에서 깨진다. 여러 줄로 만드는 순간
  // Windows 사용자는 붙여넣기가 안 되는데 그걸 화면만 봐서는 모른다.
  const lines = connectCommand("cshn_pat_abc").trim().split("\n");

  assert.equal(lines.length, 1);
  assert.ok(!lines[0].includes("\\"));
});

test("토큰과 엔드포인트가 명령 안에 박힌다", () => {
  process.env.NEXTAUTH_URL = "https://cushion.example.com/";
  const command = connectCommand("cshn_pat_abc");

  assert.ok(command.includes('--header "Authorization: Bearer cshn_pat_abc"'));
  // baseUrl()이 끝의 슬래시를 접는다 — 안 그러면 //api/mcp 가 된다
  assert.ok(command.includes(" https://cushion.example.com/api/mcp "));
  assert.ok(command.includes("--transport http"));
});

test("NEXTAUTH_URL이 없으면 Vercel 도메인으로 떨어진다", () => {
  // 배포할 때 NEXTAUTH_URL을 빠뜨려도 로그인은 멀쩡히 돌아서 눈치채기 어렵다.
  // 그때 연결 명령이 localhost를 뱉으면 팀원 아무도 못 붙는다.
  delete process.env.NEXTAUTH_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "cushion-chi.vercel.app";

  assert.ok(connectCommand("t").includes(" https://cushion-chi.vercel.app/api/mcp "));

  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  assert.ok(connectCommand("t").includes(" http://localhost:3000/api/mcp "));
});
