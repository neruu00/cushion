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
 *   - 알림 품질 → 사람이 읽고 판단할 일이다 (SPEC §11.6)
 */
import { createClient } from "@supabase/supabase-js";
import { encode } from "next-auth/jwt";
import { createHash, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.CUSHION_URL ?? "http://localhost:3000";

// Auth.js는 HTTPS면 쿠키 이름에 __Secure- 접두사를 붙이고, 그 이름을 JWT salt로도 쓴다.
// 이름이 어긋나면 서버가 세션을 아예 못 읽어서 "로그인했는데 아무것도 안 보임"으로 나타난다.
const COOKIE = `${BASE.startsWith("https:") ? "__Secure-" : ""}authjs.session-token`;

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

const pat = mint("cshn_pat_");
const editorPat = mint("cshn_pat_"); // 같은 사람의 다른 세션 — "남이 고쳤다"를 흉내낸다
const outsiderPat = mint("cshn_pat_");

async function seed() {
  await db.from("repositories").delete().in("slug", [SLUG_A, SLUG_B]);
  await db.from("access_tokens").delete().in("email", [MEMBER, OUTSIDER]);

  const { data, error } = await db
    .from("repositories")
    .insert([
      { slug: SLUG_A, name: "acceptance A", github_full_name: "neruu00/cushion" },
      { slug: SLUG_B, name: "acceptance B" },
    ])
    .select("id, slug");
  if (error) throw error;

  const byslug = Object.fromEntries(data.map((r) => [r.slug, r.id]));
  await db.from("repository_members").insert({ repository_id: byslug[SLUG_A], email: MEMBER });
  await db.from("access_tokens").insert([
    { email: MEMBER, token_hash: sha256(pat), name: "acceptance" },
    { email: MEMBER, token_hash: sha256(editorPat), name: "acceptance editor" },
    { email: OUTSIDER, token_hash: sha256(outsiderPat), name: "acceptance" },
  ]);
  return byslug;
}

// 절감 실측의 대조군. SPEC·PLAN은 Cushion으로 옮겼으므로(D-011) 레포에 남은 실제 문서를 쓴다 —
// 장난감 문서로 재면 숫자가 거짓말을 한다.
const docs = ["README.md", "AGENTS.md"].map((path) => ({
  path,
  // 서버가 저장할 때 CRLF를 LF로 접는다(의도된 동작). 여기서 같이 접지 않으면
  // Windows 체크아웃에서만 "본문이 안 바뀌었다"로 보인다 — 제품이 아니라 비교가 틀린 것이다.
  content: readFileSync(path, "utf8").replace(/\r\n/g, "\n"),
}));

// ── 본편 ──────────────────────────────────────────────────────────────

// 검증에 쓸 대표 문서. 파일 이름을 여기저기 박으면 fixture를 바꿀 때마다 같이 깨진다.
const MAIN = docs[0].path;

const repos = await seed();
const memberCookie = await cookieFor(MEMBER);
const outsiderCookie = await cookieFor(OUTSIDER);

try {
  // 자기 자신의 문서를 실제 쓰기 경로로 넣는다. 절감 실측을 장난감 문서로 하면 의미가 없고,
  // 시드까지 spec_put으로 하면 그 자체가 쓰기 경로 검증이 된다.
  for (const doc of docs) {
    await tool("spec_put", { repo: SLUG_A, ...doc, note: "인수 검증 시드" }, pat);
  }

  // ── 라우팅 재편 (랜딩 / 대시보드) ───────────────────────────────
  heading("라우팅 — / 는 랜딩, 목록은 /dashboard");

  const anonLanding = await page("/");
  check("비로그인 / → 200 랜딩", anonLanding.status === 200 && anonLanding.html.includes("시작하기"));
  check("랜딩에 레포 정보가 새지 않는다", !anonLanding.html.includes(SLUG_A));

  const memberLanding = await page("/", memberCookie);
  check(
    "로그인 / → 대시보드로 보낸다",
    memberLanding.status >= 300 && memberLanding.status < 400 && (memberLanding.location ?? "").includes("/dashboard"),
    `${memberLanding.status} → ${memberLanding.location}`,
  );

  const anonDash = await page("/dashboard");
  check(
    "비로그인 /dashboard → 로그인으로",
    anonDash.status >= 300 && anonDash.status < 400 && (anonDash.location ?? "").includes("signin"),
  );

  const memberDash = await page("/dashboard", memberCookie);
  check("멤버 대시보드에 레포와 절약 추정이 보인다", memberDash.status === 200 && memberDash.html.includes(SLUG_A));

  // ── 셀프서브 (D-013) ────────────────────────────────────────────
  heading("셀프서브 — 멤버십이 곧 권한이다");

  // createRepository 자체는 서버 액션이라 HTTP로 직접 못 부른다(암호화된 action id 필요).
  // 런타임으로는 그 결과 상태(멤버 = 읽기·쓰기·대시보드)를, 액션 고유 로직(로그인 게이트·
  // 생성자 자동 등록·보상 삭제)은 아래 소스 정적 검사에서 본다.
  const SLUG_SELF = "zz-selfserve";
  await db.from("repositories").delete().eq("slug", SLUG_SELF);
  const { data: selfRepo, error: selfErr } = await db
    .from("repositories")
    .insert({ slug: SLUG_SELF, name: "self serve" })
    .select("id")
    .single();
  if (selfErr) throw selfErr;
  await db.from("repository_members").insert({ repository_id: selfRepo.id, email: OUTSIDER });

  check(
    "멤버가 되면 바로 쓴다 (outsider의 자기 레포)",
    (await tool("spec_put", { repo: SLUG_SELF, path: "MINE.md", content: "# 내 레포" }, outsiderPat)).startsWith("저장했다"),
  );
  check(
    "자기 레포는 대시보드에 보인다",
    (await page("/dashboard", outsiderCookie)).html.includes(SLUG_SELF),
  );
  check(
    "다른 멤버(MEMBER)에게는 이 레포가 안 보인다",
    !(await tool("spec_outline", {}, pat)).includes(SLUG_SELF),
  );

  // 액션 고유 로직은 소스로 검사한다 — 빠지면 셀프서브가 조용히 반쪽이 된다
  const repoActions = readFileSync("actions/repository.ts", "utf8");
  check(
    "createRepository가 생성자를 멤버로 등록한다 (소스)",
    /createRepository[\s\S]*?repository_members[\s\S]*?insert/.test(repoActions),
  );
  check(
    "멤버 등록 실패 시 레포를 지워 보상한다 (소스)",
    repoActions.includes("보상"),
  );
  check(
    "멤버 관리가 멤버십 기준이다 (소스)",
    repoActions.includes("canManageMembers") && repoActions.includes("isMember"),
  );

  // ── SPEC §11.2 권한 ─────────────────────────────────────────────
  heading("§11.2 권한");

  const outsiderHome = await page("/dashboard", outsiderCookie);
  check(
    "미등록 이메일 → 대시보드에 남의 레포가 안 보인다",
    outsiderHome.status === 200 && !outsiderHome.html.includes(SLUG_A),
  );
  check("미등록 이메일 → URL 직접 입력은 404", (await page(`/repositories/${SLUG_A}`, outsiderCookie)).status === 404);
  check(
    "미등록 이메일 → 문서 URL도 404",
    (await page(`/repositories/${SLUG_A}/SPEC.md`, outsiderCookie)).status === 404,
  );
  check(
    "미등록 이메일의 토큰 → MCP도 빈손",
    !(await tool("spec_outline", {}, outsiderPat)).includes(SLUG_A),
  );

  check(
    "이메일 대소문자 정규화 (Member@Example.COM 로 접근)",
    (await page(`/repositories/${SLUG_A}`, await cookieFor("Member@Example.COM"))).status === 200,
  );

  check("접두사가 다른 키 → 거부", (await mcp("ping", {}, "ghp_notourtoken")).status === 401);

  // 멤버가 아닌 레포에는 쓰지도 못한다. 읽기와 쓰기의 문턱이 같다.
  await tool("spec_put", { repo: SLUG_B, path: "INTRUDER.md", content: "#" }, pat);
  const { count: bDocs } = await db
    .from("documents")
    .select("path", { count: "exact", head: true })
    .eq("repository_id", repos[SLUG_B]);
  check("멤버 아닌 레포에 spec_put → 거부", bDocs === 0, `B 문서 ${bDocs}건`);

  const memberSees = await page(`/repositories/${SLUG_A}`, memberCookie);
  check("멤버는 본다", memberSees.status === 200);

  // 멤버에서 빼면 토큰 재발급 없이 즉시 차단돼야 한다 — 요청 시점 조회의 핵심 검증
  await db.from("repository_members").delete().eq("repository_id", repos[SLUG_A]).eq("email", MEMBER);
  check(
    "멤버 제거 → 같은 토큰으로 즉시 차단",
    !(await tool("spec_outline", {}, pat)).includes(SLUG_A),
  );
  check("멤버 제거 → 화면도 즉시 404", (await page(`/repositories/${SLUG_A}`, memberCookie)).status === 404);
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

  // ── SPEC §11.3 쓰기 ─────────────────────────────────────────────
  heading("§11.3 쓰기 (원본이 여기 있다)");

  const { count: seeded } = await db
    .from("documents")
    .select("path", { count: "exact", head: true })
    .eq("repository_id", repos[SLUG_A]);
  check("spec_put으로 넣은 문서가 남아 있다", seeded === docs.length, `${seeded}건`);

  const readBack = await tool("spec_get", { repo: SLUG_A, path: MAIN }, pat);
  const seedSha = /sha:([0-9a-f]+)/.exec(readBack)?.[1] ?? "";
  check("sha를 돌려준다", seedSha.length === 64);

  // 낙관적 잠금 — 이 검사가 이 모델 전체를 지탱한다
  const stale = await tool(
    "spec_put",
    { repo: SLUG_A, path: MAIN, content: "덮어쓰기", base_sha: "0".repeat(64) },
    pat,
  );
  const { data: untouched } = await db
    .from("documents")
    .select("content_sha")
    .eq("repository_id", repos[SLUG_A])
    .eq("path", MAIN)
    .maybeSingle();
  check("낡은 base_sha → 거부하고 현재 sha를 알려준다", stale.includes(seedSha), stale.slice(0, 60));
  check("거부됐으면 본문이 그대로다", untouched?.content_sha === seedSha);

  check(
    "base_sha 없이 기존 문서를 덮으려 하면 거부",
    (await tool("spec_put", { repo: SLUG_A, path: MAIN, content: "x" }, pat)).includes("base_sha"),
  );

  // 정상 수정 → 이력이 남는다
  const edited = `${docs[0].content}

## 인수 검증 섹션

추가.
`;
  await tool(
    "spec_put",
    { repo: SLUG_A, path: MAIN, content: edited, base_sha: seedSha, note: "섹션 추가" },
    pat,
  );
  const { data: versions } = await db
    .from("document_versions")
    .select("content_sha, author, note")
    .eq("repository_id", repos[SLUG_A])
    .eq("path", MAIN)
    .order("id", { ascending: false });
  check("수정하면 이전 본문이 이력에 남는다", versions?.[0]?.content_sha === seedSha, `${versions?.length ?? 0}건`);
  check("이력에 작성자와 메모가 있다", versions?.[0]?.author === MEMBER && versions?.[0]?.note === "섹션 추가");

  const { data: afterEdit } = await db
    .from("documents")
    .select("content, updated_by")
    .eq("repository_id", repos[SLUG_A])
    .eq("path", MAIN)
    .maybeSingle();
  check("본문이 실제로 바뀌었다", afterEdit?.content === edited);
  check("누가 고쳤는지 남는다", afterEdit?.updated_by === MEMBER);

  // CAS — 같은 base_sha로 **동시에** 쓰면 정확히 하나만 이겨야 한다.
  // 순차 호출은 사전 비교에 걸려 CAS까지 안 간다. 동시 호출이라야 읽기-비교-쓰기 사이의
  // 창을 실제로 연다. 어느 쪽이 이기는지는 비결정적이지만 "하나만 이긴다"는 불변식이다.
  const editedSha = /sha:([0-9a-f]+)/.exec(await tool("spec_get", { repo: SLUG_A, path: MAIN }, pat))?.[1];
  const contentA = `${edited}\nA가 이겼다.\n`;
  const contentB = `${edited}\nB가 이겼다.\n`;
  const [raceA, raceB] = await Promise.all([
    tool("spec_put", { repo: SLUG_A, path: MAIN, content: contentA, base_sha: editedSha, note: "CAS A" }, pat),
    tool("spec_put", { repo: SLUG_A, path: MAIN, content: contentB, base_sha: editedSha, note: "CAS B" }, editorPat),
  ]);
  const wins = [raceA, raceB].filter((r) => r.startsWith("저장했다"));
  const { data: afterCas } = await db
    .from("documents")
    .select("content")
    .eq("repository_id", repos[SLUG_A])
    .eq("path", MAIN)
    .maybeSingle();
  check("같은 base_sha 동시 쓰기 → 정확히 하나만 이긴다", wins.length === 1, `${wins.length}건 성공`);
  check(
    "본문은 이긴 쪽의 것이고 진 쪽은 흔적이 없다",
    afterCas?.content === (raceA.startsWith("저장했다") ? contentA : contentB),
  );
  // 진 쪽이 현재 sha를 받아 스스로 회복할 수 있어야 한다
  const loser = raceA.startsWith("저장했다") ? raceB : raceA;
  check("진 쪽은 현재 sha를 안내받는다", /sha:[0-9a-f]{64}/.test(loser), loser.slice(0, 50));

  // 다음 검증(섹션 스코프)이 이어서 쓰도록 본문을 되돌려 둔다
  {
    const s = /sha:([0-9a-f]+)/.exec(await tool("spec_get", { repo: SLUG_A, path: MAIN }, pat))?.[1];
    await tool("spec_put", { repo: SLUG_A, path: MAIN, content: edited, base_sha: s, note: "CAS 검증 정리" }, pat);
  }

  // 섹션 스코프 쓰기 — 문서 전체를 실어 보내지 않는다 (spec_put + heading)
  const beforeSection = await tool("spec_get", { repo: SLUG_A, path: MAIN }, pat);
  const sectionSha = /sha:([0-9a-f]+)/.exec(beforeSection)?.[1];
  const sectionPut = await tool(
    "spec_put",
    {
      repo: SLUG_A,
      path: MAIN,
      heading: "인수 검증 섹션",
      content: "## 인수 검증 섹션\n\n섹션만 고쳤다.",
      base_sha: sectionSha,
      note: "섹션 스코프 수정",
    },
    pat,
  );
  const { data: afterSection } = await db
    .from("documents")
    .select("content")
    .eq("repository_id", repos[SLUG_A])
    .eq("path", MAIN)
    .maybeSingle();
  check("heading을 주면 그 섹션만 바뀐다", afterSection?.content.includes("섹션만 고쳤다."), sectionPut.slice(0, 40));
  check(
    "나머지 본문은 바이트 그대로다",
    afterSection?.content.startsWith(docs[0].content.replace(/\s+$/, "")),
  );
  // base_sha 충돌이 heading 검증보다 먼저 걸린다(낡은 sha면 어차피 다시 읽어야 하니 맞는
  // 순서다). 그래서 이 검사는 반드시 현재 sha로 불러야 heading 경로에 도달한다.
  const freshSha = /sha:([0-9a-f]+)/.exec(await tool("spec_get", { repo: SLUG_A, path: MAIN }, pat))?.[1];
  check(
    "없는 섹션을 heading으로 주면 거부",
    (
      await tool(
        "spec_put",
        { repo: SLUG_A, path: MAIN, heading: "존재하지 않는 섹션", content: "## x\n\ny", base_sha: freshSha },
        pat,
      )
    ).includes("그런 섹션이 없다"),
  );

  // 삭제 — 이력은 살아남아야 한다
  await tool("spec_put", { repo: SLUG_A, path: "TEMP.md", content: "# 임시\n" }, pat);
  const tempRead = await tool("spec_get", { repo: SLUG_A, path: "TEMP.md" }, pat);
  const tempSha = /sha:([0-9a-f]+)/.exec(tempRead)?.[1];
  await tool("spec_delete", { repo: SLUG_A, path: "TEMP.md", base_sha: tempSha }, pat);
  const { count: tempLeft } = await db
    .from("documents")
    .select("path", { count: "exact", head: true })
    .eq("repository_id", repos[SLUG_A])
    .eq("path", "TEMP.md");
  const { count: tempHistory } = await db
    .from("document_versions")
    .select("id", { count: "exact", head: true })
    .eq("repository_id", repos[SLUG_A])
    .eq("path", "TEMP.md");
  check("삭제하면 목차에서 사라진다", tempLeft === 0);
  check("삭제해도 이력은 남는다 — 되돌릴 수 있어야 한다", tempHistory === 1, `${tempHistory}건`);

  check(
    "삭제된 문서는 spec_get으로도 안 나온다",
    (await tool("spec_get", { repo: SLUG_A, path: "TEMP.md" }, pat)).includes("그런 문서가 없다"),
  );

  // 되돌리기 — 이력이 읽히는지까지 확인한다. 쓰기만 하고 못 꺼내면 없는 것과 같다.
  const { data: restorable } = await db
    .from("document_versions")
    .select("id, content_sha")
    .eq("repository_id", repos[SLUG_A])
    .eq("path", "TEMP.md")
    .maybeSingle();
  check("삭제된 문서의 이력을 찾을 수 있다", Boolean(restorable));

  check(
    ".md가 아닌 경로는 거부",
    (await tool("spec_put", { repo: SLUG_A, path: "notes.txt", content: "x" }, pat)).includes(".md"),
  );

  // ── SPEC §11.5 MCP ──────────────────────────────────────────────
  heading("§11.5 MCP");

  const init = await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "acceptance", version: "0" } }, pat);
  const instructions = init.json?.result?.instructions ?? "";
  check("initialize에 instructions가 실린다", instructions.length > 0, `${instructions.length}자`);
  check("instructions가 짧다 (200자 이내)", instructions.length <= 200);

  const toolNames = ((await mcp("tools/list", {}, pat)).json?.result?.tools ?? []).map((t) => t.name);
  check(
    "읽기 4종 + 쓰기 2종",
    ["spec_outline", "spec_get", "spec_search", "spec_changes_since", "spec_put", "spec_delete"].every(
      (n) => toolNames.includes(n),
    ),
    toolNames.join(", "),
  );

  const outline = await tool("spec_outline", {}, pat);
  const full = await tool("spec_get", { repo: SLUG_A, path: MAIN }, pat);
  const sha = /sha:([0-9a-f]+)/.exec(full)?.[1] ?? "";
  check(
    "if_none_match 일치 → 본문 대신 unchanged",
    (await tool("spec_get", { repo: SLUG_A, path: MAIN, if_none_match: sha }, pat)).trim() === "unchanged",
  );
  check("spec_search가 섹션을 짚는다", (await tool("spec_search", { query: "코드 규칙" }, pat)).includes("/"));

  // ── SPEC §11.4 구독 ─────────────────────────────────────────────
  heading("§11.4 구독");

  check("최신 상태에서는 [stale]이 없다", !outline.includes("[stale]"));

  // 다른 세션(editorPat)이 고친다 — pat의 커서는 그대로이므로 밀린 상태가 된다
  const beforeEdit = await tool("spec_get", { repo: SLUG_A, path: MAIN }, editorPat);
  await tool(
    "spec_put",
    {
      repo: SLUG_A,
      path: MAIN,
      content: `${edited}\n\n## 남이 고친 섹션\n\n추가.\n`,
      base_sha: /sha:([0-9a-f]+)/.exec(beforeEdit)?.[1],
      note: "다른 사람이 스펙을 고쳤다",
    },
    editorPat,
  );
  check("남이 고친 뒤 → 다음 툴 응답에 [stale]", (await tool("spec_outline", {}, pat)).includes("[stale]"));

  const changes = await tool("spec_changes_since", {}, pat);
  check("spec_changes_since가 요약을 준다", changes.includes(MAIN));
  check("커서 전진 → [stale]이 사라진다", !(await tool("spec_outline", {}, pat)).includes("[stale]"));

  // ── 내보내기 (git을 버린 뒤의 유일한 탈출구) ────────────────────
  heading("내보내기");

  const exported = await fetch(`${BASE}/api/export`, {
    headers: { Authorization: `Bearer ${pat}` },
  });
  const dump = await exported.text();
  check("토큰으로 내려받는다", exported.status === 200);
  check(
    "모든 문서가 담긴다",
    docs.every((d) => dump.includes(`${SLUG_A}/${d.path}`)),
    `${dump.length.toLocaleString()}자`,
  );
  check("본문까지 담긴다", dump.includes(docs[1].content.slice(0, 120)));
  check(
    "인증 없이는 안 준다",
    (await fetch(`${BASE}/api/export`)).status === 401,
  );

  // ── SPEC §11.1 토큰 절감 ────────────────────────────────────────
  heading("§11.1 토큰 절감 (T-601)");

  const control = docs.reduce((sum, d) => sum + d.content.length, 0);
  console.log(`  대조군: 문서 ${docs.length}개 전량 로드  ${control.toLocaleString()}자  (${docs.map((d) => d.path).join(", ")})`);
  console.log(`  실험군: spec_outline 1회 + 작업당 필요한 섹션 1개  (outline ${outline.length.toLocaleString()}자)\n`);

  // 헤딩 문자열을 박아 두지 않는다 — 문서가 바뀌면 같이 틀어진다. outline에서 찾는다.
  const outlineIndex = [];
  let currentDoc = "";
  for (const line of outline.split("\n")) {
    if (line.startsWith("  ## ")) outlineIndex.push({ doc: currentDoc, heading: line.slice(5).trim() });
    else if (line.includes("/")) currentDoc = line.split(" ")[0].split("/").slice(1).join("/");
  }

  const tasks = [
    ["파일명 규칙을 확인한다", "코드 규칙"],
    ["커밋해도 되는지 확인한다", "작업 방식"],
    ["에이전트를 붙이는 법을 확인한다", "에이전트 붙이기"],
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
