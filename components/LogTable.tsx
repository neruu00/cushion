/**
 * @file components/LogTable.tsx
 * @description 요청 로그 표. /admin(최근 몇 건) · /admin/logs(전체) · 사용자 상세가 공유한다.
 *
 * 서버 컴포넌트다 — 행이 많아도 클라이언트 번들 0. actor는 사용자 상세로 링크한다.
 */
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/datetime";
import type { RequestLogRow } from "@/lib/logs.db";
import { cn } from "@/lib/utils";

interface LogTableProps {
  logs: RequestLogRow[];
  /** 사용자 상세에서는 전 행이 같은 사람이라 뺀다 */
  showActor?: boolean;
  /** 상세 페이지에서는 에러를 자르지 않고 줄바꿈으로 다 보여준다 */
  fullError?: boolean;
}

const fmt = (n: number) => n.toLocaleString();

export function LogTable({ logs, showActor = true, fullError = false }: LogTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>시각</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>요청</TableHead>
          <TableHead>라이브러리</TableHead>
          {showActor && <TableHead>누가</TableHead>}
          <TableHead className="text-right">ms</TableHead>
          <TableHead>에러</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="whitespace-nowrap font-mono text-xs">
              {formatDateTime(log.created_at)}
            </TableCell>
            <TableCell className={cn("font-mono text-xs", statusColor(log.status))}>
              {log.status}
            </TableCell>
            <TableCell className="font-mono text-xs">{log.tool ?? log.method ?? "—"}</TableCell>
            <TableCell className="font-mono text-xs">{log.library ?? "—"}</TableCell>
            {showActor && (
              <TableCell className="max-w-40 truncate font-mono text-xs">
                {log.actor ? (
                  <Link
                    href={`/admin/users/${encodeURIComponent(log.actor)}`}
                    className="hover:underline"
                  >
                    {log.actor}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
            )}
            <TableCell className="text-right font-mono text-xs tabular-nums">
              {fmt(log.duration_ms)}
            </TableCell>
            <TableCell
              className={cn(
                "text-xs text-muted-foreground",
                fullError ? "whitespace-pre-wrap break-all" : "max-w-80 truncate",
              )}
            >
              {log.error ?? ""}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function statusColor(status: number): string {
  if (status >= 500) return "text-destructive font-semibold";
  if (status >= 400) return "text-amber-600";
  return "text-muted-foreground";
}
