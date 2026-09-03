/**
 * @file app/admin/page.tsx
 * @description 서비스 전반 모니터링 (D-020). admin 전용.
 *
 * proxy.ts는 로그인 여부만 본다. admin 판정은 여기서 한다.
 *
 * 멤버 관리는 여기 없다 — D-013 이후 각 라이브러리 화면에서 멤버가 직접 한다.
 * 전체 내보내기 링크만 admin 고유 기능이라 남는다 (유일한 백업, D-011).
 *
 * 사용자 목록은 users 테이블(로그인 기록)을 기반으로 library_members·access_tokens 정보를
 * 덧붙여 보여준다. 로그인만 한 사용자도 빠지지 않는다.
 *
 * 사용량은 usage_hourly의 **요청 수** 합산이다 (토큰 환산 아님). 키가 UTC 날짜라
 * 표시도 UTC다 — lib/datetime.ts로 현지화하면 "오늘"의 경계가 데이터와 어긋난다.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { LogTable } from "@/components/LogTable";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isAdmin } from "@/lib/authz";
import { formatDateTime } from "@/lib/datetime";
import { getRequestLogs } from "@/lib/logs.db";
import { supabase } from "@/lib/supabase";
import { dayKeys } from "@/lib/usage";

interface LibraryRow {
  id: string;
  slug: string;
  name: string;
  github_repos: string[];
  mattermost_webhook_url: string | null;
  discord_webhook_url: string | null;
  created_at: string;
  documents: { count: number }[];
  library_members: { count: number }[];
}

interface UserRow {
  email: string;
  /** 소속 라이브러리 수 */
  libraries: number;
  /** 유효(미폐기) 토큰 수 */
  tokens: number;
  /** 토큰의 마지막 사용 시각. null = 토큰이 없거나 쓴 적 없음 */
  lastUsedAt: string | null;
  /** users 테이블 가입 시각 */
  createdAt: string | null;
}

const USAGE_DAYS = 14;
const RECENT_LOGS = 20;
const fmt = (n: number) => n.toLocaleString();

export default async function AdminPage() {
  // admin이 아니면 404. 403은 "그런 화면이 있다"를 알려준다.
  if (!(await isAdmin())) notFound();

  const [librariesRes, usersRes, membersRes, tokensRes, usageRes, logs] = await Promise.all([
    supabase
      .from("libraries")
      .select(
        "id, slug, name, github_repos, mattermost_webhook_url, discord_webhook_url, created_at, documents(count), library_members(count)",
      )
      .order("slug"),
    supabase.from("users").select("email, created_at").order("created_at", { ascending: false }),
    supabase.from("library_members").select("email"),
    supabase.from("access_tokens").select("email, last_used_at, revoked_at"),
    supabase
      .from("usage_hourly")
      .select("day, tool, calls")
      .gte("day", dayKeys(USAGE_DAYS)[0]),
    getRequestLogs({ limit: RECENT_LOGS }),
  ]);

  for (const res of [librariesRes, usersRes, membersRes, tokensRes, usageRes]) {
    if (res.error) console.error("AdminPage", res.error);
  }

  const libraries: LibraryRow[] = librariesRes.data ?? [];

  // 사용자 = users 테이블(로그인 기록)을 기반으로 멤버·토큰 정보를 덧붙인다.
  // users 행이 없는데 멤버나 토큰만 있는 경우(마이그레이션 이전 데이터)도 합친다.
  const people = new Map<string, UserRow>();
  const person = (email: string): UserRow => {
    let entry = people.get(email);
    if (!entry) {
      entry = { email, libraries: 0, tokens: 0, lastUsedAt: null, createdAt: null };
      people.set(email, entry);
    }
    return entry;
  };
  for (const row of usersRes.data ?? []) {
    person(row.email).createdAt = row.created_at;
  }
  for (const row of membersRes.data ?? []) person(row.email).libraries += 1;
  for (const row of tokensRes.data ?? []) {
    const entry = person(row.email);
    if (!row.revoked_at) entry.tokens += 1;
    if (row.last_used_at && (!entry.lastUsedAt || row.last_used_at > entry.lastUsedAt)) {
      entry.lastUsedAt = row.last_used_at;
    }
  }
  const users = [...people.values()].sort((a, b) =>
    (b.lastUsedAt ?? b.createdAt ?? "") > (a.lastUsedAt ?? a.createdAt ?? "") ? 1 : -1,
  );

  // 요청 수: 일별 합산 + 툴별 합산. 규모가 작아 JS에서 접는다 (미해결 5번과 같은 판단)
  const byDay = new Map<string, number>(dayKeys(USAGE_DAYS).map((key) => [key, 0]));
  const byTool = new Map<string, number>();
  let totalCalls = 0;
  for (const row of usageRes.data ?? []) {
    if (byDay.has(row.day)) byDay.set(row.day, byDay.get(row.day)! + row.calls);
    byTool.set(row.tool, (byTool.get(row.tool) ?? 0) + row.calls);
    totalCalls += row.calls;
  }
  const peak = Math.max(1, ...byDay.values());
  const toolTotals = [...byTool.entries()].sort((a, b) => b[1] - a[1]);
  const documentCount = libraries.reduce((sum, row) => sum + (row.documents[0]?.count ?? 0), 0);

  return (
    <PageShell className="space-y-8">
      <PageHeader
        title="관리"
        description={
          <>
            서비스 전체를 한눈에 볼 수 있는 화면이에요. 멤버 관리는 각 라이브러리 화면에서
            해요.{" "}
            {/* git이 없으므로 이게 유일한 백업이다 (D-011).
                라우트 핸들러가 파일을 내려주므로 <Link>의 클라이언트 이동으로는 다운로드가 안 된다. */}
            <a href="/api/export" className="underline underline-offset-4 hover:text-foreground">
              전체 내보내기
            </a>
          </>
        }
      />

      {/* 요약 — 각 섹션 표의 행 수와 같은 값이라 따로 조회하지 않는다 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["라이브러리", libraries.length],
          ["문서", documentCount],
          ["사용자", users.length],
          [`${USAGE_DAYS}일 요청`, totalCalls],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-mono text-2xl font-semibold tabular-nums">{fmt(Number(value))}</p>
          </div>
        ))}
      </section>

      {/* 요청 수 — usage_hourly.calls 합산 (D-020). 막대는 CSS 폭이면 충분하다 */}
      <section className="space-y-3 rounded-lg border p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">요청 수</h2>
          <p className="text-xs text-muted-foreground">
            최근 {USAGE_DAYS}일 동안의 MCP 툴 호출 횟수예요. 날짜는 UTC를 기준으로 하고,{" "}
            <code>library</code> 인자 없이 부른 <code>doc_outline</code>은 집계에서 빼요. 빠진 것을
            포함한 전부는 아래 요청 로그에서 볼 수 있어요.
          </p>
        </div>
        <div className="space-y-1">
          {[...byDay.entries()].map(([day, calls]) => (
            <div key={day} className="flex items-center gap-2">
              <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">
                {day.slice(5)}
              </span>
              <div className="h-4 flex-1">
                <div
                  className="h-4 rounded-sm bg-chart-4/70"
                  style={{ width: `${(calls / peak) * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums">
                {fmt(calls)}
              </span>
            </div>
          ))}
        </div>
        {toolTotals.length > 0 && (
          <p className="border-t pt-3 text-xs text-muted-foreground">
            {toolTotals.map(([tool, calls]) => `${tool} ${fmt(calls)}`).join(" · ")}
          </p>
        )}
      </section>

      {/* 요청 로그 — 에러 화면은 따로 없다. 상태 필터가 그 자리고, 필터는 /admin/logs에 있다 (D-020) */}
      <section className="space-y-3 rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">요청 로그</h2>
            <p className="text-xs text-muted-foreground">
              가장 최근 {RECENT_LOGS}건이에요. 상태 필터와 전체 목록은 전체 보기에서 확인할 수
              있어요.
            </p>
          </div>
          <Link
            href="/admin/logs"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            전체 보기 →
          </Link>
        </div>

        {logs.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            아직 로그가 없어요.
          </p>
        ) : (
          <LogTable logs={logs} />
        )}
      </section>

      {/* 라이브러리 */}
      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="text-sm font-medium">라이브러리</h2>
        {libraries.length === 0 ? (
          <p className="text-sm text-muted-foreground">등록된 라이브러리가 없어요.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>slug</TableHead>
                <TableHead>이름</TableHead>
                <TableHead className="text-right">문서</TableHead>
                <TableHead className="text-right">멤버</TableHead>
                <TableHead>알림</TableHead>
                <TableHead>GitHub</TableHead>
                <TableHead>생성</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {libraries.map((library) => (
                <TableRow key={library.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/libraries/${library.slug}`} className="hover:underline">
                      {library.slug}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{library.name}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {fmt(library.documents[0]?.count ?? 0)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {fmt(library.library_members[0]?.count ?? 0)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[
                      library.mattermost_webhook_url ? "Mattermost" : null,
                      library.discord_webhook_url ? "Discord" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "없음"}
                  </TableCell>
                  <TableCell className="max-w-48 truncate font-mono text-xs text-muted-foreground">
                    {library.github_repos.join(", ") || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatDateTime(library.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* 사용자 */}
      <section className="space-y-3 rounded-lg border p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">사용자</h2>
          <p className="text-xs text-muted-foreground">
            한 번이라도 로그인한 적이 있는 사용자 전체예요. 멤버와 토큰 정보는 각 라이브러리
            화면에서 확인할 수 있어요.
          </p>
        </div>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 아무도 없어요.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead className="text-right">라이브러리</TableHead>
                <TableHead className="text-right">유효 토큰</TableHead>
                <TableHead>토큰 최근 사용</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((entry) => (
                <TableRow key={entry.email}>
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/admin/users/${encodeURIComponent(entry.email)}`}
                      className="hover:underline"
                    >
                      {entry.email}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {fmt(entry.libraries)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {fmt(entry.tokens)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {/* 5분 스로틀이라 근사치다 (SPEC §5) */}
                    {entry.lastUsedAt ? formatDateTime(entry.lastUsedAt) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </PageShell>
  );
}

