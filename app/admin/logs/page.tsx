/**
 * @file app/admin/logs/page.tsx
 * @description 요청 로그 전체 (D-020). admin 전용. /admin 로그 섹션의 "전체 보기"다.
 *
 * 필터는 상태 탭(`?status=`), 페이지네이션은 id 커서(`?before=`)다.
 * offset 페이지네이션을 안 쓰는 이유: 로그는 계속 쌓여서 offset이 같은 행을 두 번 보여준다.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { LogTable } from "@/components/LogTable";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { isAdmin } from "@/lib/authz";
import {
  getRequestLogs,
  LOG_STATUS_FILTERS,
  parseLogStatusFilter,
  type LogStatusFilter,
} from "@/lib/logs.db";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 200;

function href(status: LogStatusFilter, before?: number): string {
  const query = new URLSearchParams();
  if (status !== "all") query.set("status", status);
  if (before) query.set("before", String(before));
  const qs = query.toString();
  return qs ? `/admin/logs?${qs}` : "/admin/logs";
}

export default async function AdminLogsPage({ searchParams }: PageProps<"/admin/logs">) {
  // admin이 아니면 404. 403은 "그런 화면이 있다"를 알려준다.
  if (!(await isAdmin())) notFound();

  const params = await searchParams;
  const filter = parseLogStatusFilter(params.status);
  const beforeRaw = Number(params.before);
  const before = Number.isInteger(beforeRaw) && beforeRaw > 0 ? beforeRaw : undefined;

  const logs = await getRequestLogs({ status: filter, before, limit: PAGE_SIZE });

  return (
    <PageShell className="space-y-6">
      <PageHeader
        breadcrumb={
          <Link href="/admin" className="hover:underline">
            관리
          </Link>
        }
        title="요청 로그"
        description="MCP 요청 전부예요. 5xx가 곧 버그예요 — 에러 원문은 자르지 않고 보여줘요."
        action={
          <nav aria-label="상태 필터" className="flex shrink-0 gap-1 text-xs">
            {LOG_STATUS_FILTERS.map((item) => (
              <Link
                key={item.value}
                href={href(item.value)}
                aria-current={item.value === filter ? "page" : undefined}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  item.value === filter
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        }
      />

      {logs.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {before ? "여기가 끝이에요." : "이 조건의 로그가 없어요."}
        </p>
      ) : (
        <>
          <LogTable logs={logs} fullError />
          {/* 정확히 한 페이지를 채웠으면 더 있을 수 있다. 덜 채웠으면 끝이다 */}
          {logs.length === PAGE_SIZE && (
            <p className="text-center text-sm">
              <Link
                href={href(filter, logs[logs.length - 1].id)}
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                이전 {PAGE_SIZE}건 더 보기
              </Link>
            </p>
          )}
        </>
      )}
    </PageShell>
  );
}
