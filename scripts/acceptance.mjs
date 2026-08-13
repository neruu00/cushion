/**
 * @file scripts/acceptance.mjs
 * @description SPEC.md §11 인수 검증. 손검증 항목을 다시 손으로 하지 않기 위해 존재한다.
 *
 *   터미널 1: pnpm dev
 *   터미널 2: pnpm acceptance
 *
 * 실제 DB에 임시 레포·멤버·토큰을 만들고 끝나면 지운다. Mattermost webhook은 비워 두므로
 * 외부로 나가는 요청은 없다. 로그인 상태는 NEXTAUTH_SECRET으로 세션 쿠키를 직접 만들어 흉내낸다.
 *
 * 여기서 못 잡는 것:
 *   - ADMIN_EMAILS 빈 값 fail-closed → 서버를 다른 env로 다시 띄워야 한다. 맨 아래 안내 참조
 *   - cushion-sync.yml 실동작 → GitHub Actions가 필요하다 (T-303)
 *   - 알림 품질 → 사람이 읽고 판단할 일이다 (SPEC §11.6)
 */
import { createClient } from "@supabase/supabase-js";
import { encode } from "next-auth/jwt";
import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.CUSHION_URL ?? "http://localhost:3000";
const COOKIE = "authjs.session-token";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const sha256 = (v) => createHash("sha256").update(v).digest("hex");
const mint = (prefix) => prefix + randomBytes(32).toString("base64url");

const SLUG_A = "zz-acceptance-a";
const SLUG_B = "zz-acceptance-b";
const MEMBER = "member@example.com";
const OUTSIDER = "outsider@example.com";

let failures = 0;
let section = "";

function heading(title) {
  section = title;
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

function check(label, ok, detail = "") {
  if (!ok) failures += 1;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) console.log(`      ↑ ${section}`);
}

// ── 클라이언트 ────────────────────────────────────────────────────────

const cookieFor = async (email) =>
  `${COOKIE}=${await encode({
    token: { email, sub: email },
    secret: process.env.NEXTAUTH_SECRET,
    salt: COOKIE,
    maxAge: 600,
  })}`;

const page = (path, cookie) =>
  fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" }).then(
    async (r) => ({ status: r.status, location: r.headers.get("location"), html: await r.text() }),
  );

const sync = (body, bearer) =>
  fetch(`${BASE}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let rpcId = 0;
const mcp = (method, params, bearer) =>
  fetch(`${BASE}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

async function tool(name, args, bearer) {
  const { json } = await mcp("tools/call", { name, arguments: args }, bearer);
  return json?.result?.content?.[0]?.text ?? "";
}

// ── 준비 ──────────────────────────────────────────────────────────────

const syncA = mint("cshn_sync_");
const syncB = mint("cshn_sync_");
const pat = mint("cshn_pat_");
const outsiderPat = mint("cshn_pat_");

async function seed() {
  await db.from("repositories").delete().in("slug", [SLUG_A, SLUG_B]);
  await db.from("access_tokens").delete().in("email", [MEMBER, OUTSIDER]);

  const { data, error } = await db
    .from("repositories")
    .insert([
      { slug: SLUG_A, name: "acceptance A", github_full_name: "neruu00/cushion", sync_token_hash: sha256(syncA) },
      { slug: SLUG_B, name: "acceptance B", sync_token_hash: sha256(syncB) },
    ])
    .select("id, slug");
  if (error) throw error;

  const byslug = Object.fromEntries(data.map((r) => [r.slug, r.id]));
  await db.from("repository_members").insert({ repository_id: byslug[SLUG_A], email: MEMBER });
  await db.from("access_tokens").insert([
    { email: MEMBER, token_hash: sha256(pat), name: "acceptance" },
    { email: OUTSIDER, token_hash: sha256(outsiderPat), name: "acceptance" },
  ]);
  return byslug;
}

const docs = ["SPEC.md", "AGENTS.md", "PLAN.md"].map((path) => ({
  path,
  content: readFileSync(path, "utf8"),
}));

// ── 본편 ──────────────────────────────────────────────────────────────

const repos = await seed();
const memberCookie = await cookieFor(MEMBER);
const outsiderCookie = await cookieFor(OUTSIDER);

try {
  // 자기 자신의 문서를 미러에 넣는다. 절감 실측을 장난감 문서로 하면 의미가 없다.
  await sync(
    {
      commit: { sha: "acc0001", author: "neruu00", message: "인수 검증 시드" },
      changed: docs,
      deleted: [],
      diff: "",
    },
    syncA,
  );

  // ── SPEC §11.2 권한 ─────────────────────────────────────────────
  heading("§11.2 권한");

  const outsiderHome = await page("/", outsiderCookie);
  check(
    "미등록 이메일 → 레포 목록에 안 보인다",
    outsiderHome.status === 200 && !outsiderHome.html.includes(SLUG_A),
  );
  check("미등록 이메일 → URL 직접 입력은 404", (await page(`/${SLUG_A}`, outsiderCookie)).status === 404);
  check(
    "미등록 이메일 → 문서 URL도 404",
    (await page(`/${SLUG_A}/SPEC.md`, outsiderCookie)).status === 404,
  );
  check(
    "미등록 이메일의 토큰 → MCP도 빈손",
    !(await tool("spec_outline", {}, outsiderPat)).includes(SLUG_A),
  );

  check(
    "이메일 대소문자 정규화 (Member@Example.COM 로 접근)",
    (await page(`/${SLUG_A}`, await cookieFor("Member@Example.COM"))).status === 200,
  );

  check("sync 토큰으로 /api/mcp → 거부", (await mcp("ping", {}, syncA)).status === 401);
  check("access 토큰으로 /api/sync → 거부", (await sync({}, pat)).status === 401);

  // 레포 A의 토큰은 A만 가리킨다. B를 갱신할 방법이 표현 자체로 없다.
  await sync(
    { commit: { sha: "acc0002", author: "x", message: "침범 시도" }, changed: [{ path: "INTRUDER.md", content: "#" }], deleted: [], diff: "" },
    syncA,
  );
  const { count: bDocs } = await db
    .from("documents")
    .select("path", { count: "exact", head: true })
    .eq("repository_id", repos[SLUG_B]);
  check("레포 A의 sync 토큰으로 B를 갱신할 수 없다", bDocs === 0, `B 문서 ${bDocs}건`);

  const memberSees = await page(`/${SLUG_A}`, memberCookie);
  check("멤버는 본다", memberSees.status === 200);

  // 멤버에서 빼면 토큰 재발급 없이 즉시 차단돼야 한다 — 요청 시점 조회의 핵심 검증
  await db.from("repository_members").delete().eq("repository_id", repos[SLUG_A]).eq("email", MEMBER);
  check(
    "멤버 제거 → 같은 토큰으로 즉시 차단",
    !(await tool("spec_outline", {}, pat)).includes(SLUG_A),
  );
  check("멤버 제거 → 화면도 즉시 404", (await page(`/${SLUG_A}`, memberCookie)).status === 404);
  await db.from("repository_members").insert({ repository_id: repos[SLUG_A], email: MEMBER });

  // 폐기된 토큰은 즉시 죽는다
  const throwaway = mint("cshn_pat_");
  await db.from("access_tokens").insert({ email: MEMBER, token_hash: sha256(throwaway), name: "throwaway" });
  check("발급 직후 토큰은 통한다", (await mcp("ping", {}, throwaway)).status === 200);
  await db
    .from("access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token_hash", sha256(throwaway));
  check("폐기 후 같은 토큰 → 401", (await mcp("ping", {}, throwaway)).status === 401);

  const anonAdmin = await page("/admin");
  check(
    "비로그인 /admin → 로그인으로",
    anonAdmin.status >= 300 && anonAdmin.status < 400 && (anonAdmin.location ?? "").includes("signin"),
    `${anonAdmin.status} → ${anonAdmin.location}`,
  );
  check("비 admin 로그인 /admin → 404", (await page("/admin", memberCookie)).status === 404);

  // ── 서버 액션 정적 검사 ─────────────────────────────────────────
  heading("§11.2 서버 액션은 스스로 권한을 본다");

  // proxy.ts는 서버 액션 호출을 막지 못한다. 런타임으로 찌르려면 빌드 해시가 필요해서
  // 소스로 확인한다 — 한 곳이라도 빠지면 그대로 뚫린다.
  for (const file of readdirSync("actions").filter((f) => f.endsWith(".ts"))) {
    if (file === "session.ts") continue; // 로그인·로그아웃은 세션이 없어야 부른다
    const source = readFileSync(join("actions", file), "utf8");
    const bodies = source.split(/export async function /).slice(1);
    for (const body of bodies) {
      const name = body.slice(0, body.indexOf("("));
      check(
        `actions/${file} · ${name}()`,
        /isAdmin\(\)|getSessionEmail\(\)/.test(body.slice(0, 400)),
        "권한 확인 있음",
      );
    }
  }

  // ── SPEC §11.3 동기화 ───────────────────────────────────────────
  heading("§11.3 동기화");

  const { count: seeded } = await db
    .from("documents")
    .select("path", { count: "exact", head: true })
    .eq("repository_id", repos[SLUG_A]);
  check("push한 문서가 미러에 있다", seeded === docs.length + 1, `${seeded}건`);

  await sync(
    { commit: { sha: "acc0003", author: "x", message: "폐기" }, changed: [], deleted: ["INTRUDER.md"], diff: "" },
    syncA,
  );
  const { data: afterDelete } = await db
    .from("documents")
    .select("path")
    .eq("repository_id", repos[SLUG_A])
    .eq("path", "INTRUDER.md");
  check("삭제 push → 미러에서도 사라진다 (T-603)", (afterDelete ?? []).length === 0);

  await sync(
    { full: true, commit: { sha: "acc0004", author: "x", message: "전체" }, changed: [docs[0]], deleted: [], diff: "" },
    syncA,
  );
  const { data: afterFull } = await db
    .from("documents")
    .select("path")
    .eq("repository_id", repos[SLUG_A]);
  check(
    "full 동기화 → 페이로드에 없는 문서 제거",
    afterFull.length === 1 && afterFull[0].path === "SPEC.md",
    afterFull.map((d) => d.path).join(", "),
  );

  const before = await db
    .from("sync_events")
    .select("id", { count: "exact", head: true })
    .eq("repository_id", repos[SLUG_A]);
  await sync({ full: true, changed: [], deleted: [], diff: "" }, syncA);
  const after = await db
    .from("sync_events")
    .select("id", { count: "exact", head: true })
    .eq("repository_id", repos[SLUG_A]);
  check("빈 동기화는 미러도 커서도 건드리지 않는다", before.count === after.count);

  // 되돌려 놓는다 — 아래 절감 실측이 문서 3개를 다 본다
  await sync(
    { full: true, commit: { sha: "acc0005", author: "neruu00", message: "복구" }, changed: docs, deleted: [], diff: "" },
    syncA,
  );

  // ── SPEC §11.5 MCP ──────────────────────────────────────────────
  heading("§11.5 MCP");

  const init = await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "acceptance", version: "0" } }, pat);
  const instructions = init.json?.result?.instructions ?? "";
  check("initialize에 instructions가 실린다", instructions.length > 0, `${instructions.length}자`);
  check("instructions가 짧다 (200자 이내)", instructions.length <= 200);

  const toolNames = ((await mcp("tools/list", {}, pat)).json?.result?.tools ?? []).map((t) => t.name);
  check(
    "툴 4종",
    ["spec_outline", "spec_get", "spec_search", "spec_changes_since"].every((n) => toolNames.includes(n)),
    toolNames.join(", "),
  );
  check("쓰기 툴이 없다", toolNames.every((n) => n.startsWith("spec_")), toolNames.length + "개");

  const outline = await tool("spec_outline", {}, pat);
  const full = await tool("spec_get", { repo: SLUG_A, path: "SPEC.md" }, pat);
  const sha = /sha:([0-9a-f]+)/.exec(full)?.[1] ?? "";
  check(
    "if_none_match 일치 → 본문 대신 unchanged",
    (await tool("spec_get", { repo: SLUG_A, path: "SPEC.md", if_none_match: sha }, pat)).trim() === "unchanged",
  );
  check("spec_search가 섹션을 짚는다", (await tool("spec_search", { query: "sync token" }, pat)).includes("SPEC.md"));

  // ── SPEC §11.4 구독 ─────────────────────────────────────────────
  heading("§11.4 구독");

  check("최신 상태에서는 [stale]이 없다", !outline.includes("[stale]"));

  await sync(
    {
      commit: { sha: "acc0006", author: "someone", message: "다른 사람이 스펙을 고쳤다" },
      changed: [{ path: "SPEC.md", content: docs[0].content + "\n\n## 새 섹션\n\n추가.\n" }],
      deleted: [],
      diff: "",
    },
    syncA,
  );
  check("다른 사람 push 후 → 다음 툴 응답에 [stale]", (await tool("spec_outline", {}, pat)).includes("[stale]"));

  const changes = await tool("spec_changes_since", {}, pat);
  check("spec_changes_since가 요약을 준다", changes.includes("SPEC.md"));
  check("커서 전진 → [stale]이 사라진다", !(await tool("spec_outline", {}, pat)).includes("[stale]"));

  // ── SPEC §11.1 토큰 절감 ────────────────────────────────────────
  heading("§11.1 토큰 절감 (T-601)");

  const control = docs.reduce((sum, d) => sum + d.content.length, 0);
  console.log(`  대조군: 스펙 3개 전량 로드  ${control.toLocaleString()}자`);
  console.log(`  실험군: spec_outline 1회 + 작업당 필요한 섹션 1개  (outline ${outline.length.toLocaleString()}자)\n`);

  // 헤딩 문자열을 박아 두지 않는다 — 문서가 바뀌면 같이 틀어진다. outline에서 찾는다.
  const outlineIndex = [];
  let currentDoc = "";
  for (const line of outline.split("\n")) {
    if (line.startsWith("  ## ")) outlineIndex.push({ doc: currentDoc, heading: line.slice(5).trim() });
    else if (line.includes("/")) currentDoc = line.split(" ")[0].split("/").slice(1).join("/");
  }

  const tasks = [
    ["토큰 발급 규칙을 확인한다", "인증"],
    ["MCP 툴 인자를 확인한다", "MCP 서버"],
    ["파일명 규칙을 확인한다", "코드 규칙"],
  ];

  let experiment = outline.length;
  for (const [task, keyword] of tasks) {
    const hit = outlineIndex.find((h) => h.heading.includes(keyword));
    if (!hit) {
      check(`실측: ${task}`, false, `outline에서 '${keyword}' 섹션을 못 찾았다`);
      continue;
    }
    const text = await tool("spec_get", { repo: SLUG_A, path: hit.doc, heading: hit.heading }, pat);
    experiment += text.length;
    console.log(`  ${task}\n    → ${hit.doc} ## ${hit.heading}  ${text.length.toLocaleString()}자`);
  }

  const ratio = control / experiment;
  console.log(`\n  실험군 합계(outline 1회 + 섹션 3개): ${experiment.toLocaleString()}자`);
  console.log(`  대조군 대비 ${(100 / ratio).toFixed(1)}%  —  ${ratio.toFixed(1)}배 절감`);
  console.log(`  ※ 문자 수다. 토크나이저마다 절대값은 달라지지만 비교하는 두 값이 같은 종류의 글이라 비율은 유지된다.`);
  check("실험군이 대조군보다 작다", experiment < control);
} finally {
  await db.from("repositories").delete().in("slug", [SLUG_A, SLUG_B]);
  await db.from("access_tokens").delete().in("email", [MEMBER, OUTSIDER]);

  console.log(`\n${failures === 0 ? "전부 통과" : `${failures}건 실패`}. 임시 데이터 정리 완료.`);
  console.log(
    "\n남은 손검증 2가지:\n" +
      '  1. ADMIN_EMAILS 빈 값 → /admin 거부. 서버를 ADMIN_EMAILS=" , " 로 다시 띄우고\n' +
      "     admin 세션으로 /admin 이 404인지 본다. 빈 문자열이 아니라 공백인 이유는 Windows가\n" +
      "     빈 환경변수를 프로세스에 안 넘기기 때문이다. 이전 dev 서버가 정말 죽었는지도 확인할 것\n" +
      "     (포트를 물고 있으면 옛 서버가 대신 답해서 통과한 것처럼 보인다).\n" +
      "  2. 알림 품질 (SPEC §11.6) — 받은 메시지 3건이 링크를 열지 않고 판단하게 하는지.",
  );
}

process.exit(failures === 0 ? 0 : 1);
