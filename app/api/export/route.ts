/**
 * @file app/api/export/route.ts
 * @description 접근 가능한 문서 전체를 한 파일로 내려받는다.
 *
 * git을 버린 이상(D-011) **이게 유일한 탈출구다.** Cushion이 죽거나 실수로 지웠을 때
 * 되돌릴 근거가 여기밖에 없다. 그래서 화면이 아니라 항상 있는 엔드포인트로 둔다.
 *
 * 형식은 아카이브 라이브러리를 들이지 않고 구분선으로 나눈 평문이다 — 사람이 읽을 수 있고,
 * 스크립트로 쪼개기도 쉽다. tar/zip이 필요해지면 그때 넣는다.
 */
import type { NextRequest } from "next/server";

import { getAccessibleLibraries, getSessionEmail, identityFromAccessToken } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

const SEPARATOR = "=".repeat(70);

export async function GET(request: NextRequest): Promise<Response> {
  // 사람은 세션으로, 에이전트·백업 스크립트는 토큰으로. 둘 다 같은 권한을 본다.
  const identity = await identityFromAccessToken(request.headers.get("authorization"));
  const email = identity?.email ?? (await getSessionEmail());
  if (!email) return new Response("unauthorized", { status: 401 });

  const repos = await getAccessibleLibraries(email);
  if (repos.length === 0) return new Response("접근 가능한 문서가 없다.\n", { status: 200 });

  const { data, error } = await supabase
    .from("documents")
    .select("library_id, path, content, updated_at, updated_by")
    .in(
      "library_id",
      repos.map((repo) => repo.id),
    )
    .order("path");

  if (error) {
    console.error("export", error);
    return new Response("export failed", { status: 500 });
  }

  const slug = new Map(repos.map((repo) => [repo.id, repo.slug]));
  const stamp = new Date().toISOString();
  const body = [
    `# cushion export ${stamp}`,
    `# ${data?.length ?? 0} documents · ${email}`,
    "",
    ...(data ?? []).map(
      (doc: {
        library_id: string;
        path: string;
        content: string;
        updated_at: string;
        updated_by: string | null;
      }) =>
        [
          SEPARATOR,
          `${slug.get(doc.library_id)}/${doc.path}`,
          `updated ${doc.updated_at}${doc.updated_by ? ` by ${doc.updated_by}` : ""}`,
          SEPARATOR,
          doc.content,
          "",
        ].join("\n"),
    ),
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="cushion-${stamp.slice(0, 10)}.txt"`,
    },
  });
}
