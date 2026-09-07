/**
 * @file app/admin/users/[email]/page.tsx
 * @description 사용자 한 명 상세 (D-020). admin 전용.
 *
 * users 테이블에 있는 이메일이면 멤버나 토큰이 없어도 보여준다.
 * users에도 없으면 404다.
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
import { getDict } from "@/lib/i18n";
import { fill } from "@/lib/utils";

interface MembershipRow {
  created_at: string;
  libraries: { slug: string; name: string } | null;
}

interface TokenRow {
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const LOG_LIMIT = 50;

export default async function UserDetailPage({ params }: PageProps<"/admin/users/[email]">) {
  // admin이 아니면 404. 403은 "그런 화면이 있다"를 알려준다.
  if (!(await isAdmin())) notFound();

  // 이메일은 조회 양쪽에서 lowercase다 (SPEC §6) — URL로 들어온 값도 예외가 아니다
  const email = decodeURIComponent((await params).email).toLowerCase();

  const [userRes, membershipsRes, tokensRes, logs] = await Promise.all([
    supabase.from("users").select("email").eq("email", email).maybeSingle(),
    supabase
      .from("library_members")
      .select("created_at, libraries(slug, name)")
      .eq("email", email)
      .order("created_at"),
    supabase
      .from("access_tokens")
      .select("name, created_at, last_used_at, revoked_at")
      .eq("email", email)
      .order("created_at", { ascending: false }),
    getRequestLogs({ actor: email, limit: LOG_LIMIT }),
  ]);

  if (userRes.error) console.error("UserDetailPage user", userRes.error);
  if (membershipsRes.error) console.error("UserDetailPage members", membershipsRes.error);
  if (tokensRes.error) console.error("UserDetailPage tokens", tokensRes.error);

  const memberships = (membershipsRes.data as MembershipRow[] | null) ?? [];
  const tokens = (tokensRes.data as TokenRow[] | null) ?? [];

  const t = (await getDict()).admin;

  // users 테이블에도 없고 멤버도 아니고 토큰도 없으면 그런 사용자는 없다
  if (!userRes.data && memberships.length === 0 && tokens.length === 0) notFound();

  return (
    <PageShell className="space-y-8">
      <PageHeader
        breadcrumb={
          <Link href="/admin" className="hover:underline">
            {t.title}
          </Link>
        }
        title={<span className="font-mono">{email}</span>}
        description={fill(t.userDescription, {
          libraries: memberships.length,
          tokens: tokens.length,
        })}
      />

      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="text-sm font-medium">{t.memberOf}</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.memberOfEmpty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>slug</TableHead>
                <TableHead>{t.colName}</TableHead>
                <TableHead>{t.colJoined}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((membership) => (
                <TableRow key={membership.libraries?.slug ?? membership.created_at}>
                  <TableCell className="font-mono text-xs">
                    {membership.libraries ? (
                      <Link
                        href={`/libraries/${membership.libraries.slug}`}
                        className="hover:underline"
                      >
                        {membership.libraries.slug}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{membership.libraries?.name ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatDateTime(membership.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-5">
        <h2 className="text-sm font-medium">{t.tokensHeading}</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.tokensEmpty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.colName}</TableHead>
                <TableHead>{t.colStatus}</TableHead>
                <TableHead>{t.colIssued}</TableHead>
                <TableHead>{t.colLastUsedShort}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.created_at}>
                  <TableCell className="text-xs">{token.name ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {token.revoked_at ? (
                      <span className="text-muted-foreground">{t.tokenRevoked}</span>
                    ) : (
                      t.tokenLive
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {formatDateTime(token.created_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                    {/* 5분 스로틀이라 근사치다 (SPEC §5) */}
                    {token.last_used_at ? formatDateTime(token.last_used_at) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-medium">{fill(t.recentRequests, { count: LOG_LIMIT })}</h2>
          <Link
            href="/admin/logs"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t.allLogs}
          </Link>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noRequests}</p>
        ) : (
          <LogTable logs={logs} showActor={false} />
        )}
      </section>
    </PageShell>
  );
}
