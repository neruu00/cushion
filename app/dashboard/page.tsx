/**
 * @file app/dashboard/page.tsx
 * @description 내 레포 목록 + 레포 만들기 (D-013).
 *
 * 절약 추정은 여기 두지 않는다 — 레포에 들어가면 보인다. 목록 화면이 전 레포의
 * 문서 본문을 읽어야 하는 건 목록이 할 일이 아니다.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { NewRepoDialog } from "@/components/NewRepoDialog";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessibleRepos, getSessionEmail } from "@/lib/authz";

export default async function DashboardPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/api/auth/signin?callbackUrl=%2Fdashboard");

  const repos = await getAccessibleRepos(email);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">대시보드</h1>
          <p className="text-sm text-muted-foreground">
            문서 원본은 Cushion에 있다. 여기서 만들고, 에이전트는 MCP로 읽고 쓴다.
          </p>
        </div>
        <NewRepoDialog />
      </header>

      {repos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          아직 레포가 없다. &quot;새 레포&quot;로 만들거나, 팀원에게 초대를 부탁할 것.
        </p>
      ) : (
        <ul className="space-y-3">
          {repos.map((repo) => (
            <li key={repo.id}>
              <Link href={`/repositories/${repo.slug}`} className="block">
                <Card className="transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle className="font-mono text-base">{repo.slug}</CardTitle>
                    <CardDescription>
                      {repo.name}
                      {repo.github_full_name ? ` · ${repo.github_full_name}` : ""}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
