/**
 * @file app/dashboard/page.tsx
 * @description 내 레포 목록 + 레포 만들기 (D-013).
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { NewLibraryDialog } from "@/components/NewLibraryDialog";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMemberLibraries, getSessionEmail } from "@/lib/authz";

export default async function DashboardPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/api/auth/signin?callbackUrl=%2Fdashboard");

  // admin이어도 예외 없이 내가 속한 것만 — 전체 조망은 /admin의 몫이다 (SPEC §6).
  const repos = await getMemberLibraries(email);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="대시보드"
        description="문서의 원본은 Cushion에 보관돼요. 여기서 라이브러리를 만들면 에이전트가 MCP로 그 문서를 읽고 써요."
        // 비어 있으면 아래 빈 상태가 곧 CTA다 — 버튼이 두 군데면 눈이 갈린다
        action={repos.length > 0 ? <NewLibraryDialog /> : undefined}
      />

      {repos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            아직 라이브러리가 없어요.
            <br />
            직접 새로 만들거나 팀원에게 초대를 요청하세요. 초대를 받으면 이 목록에 바로 나타나요.
          </p>
          <NewLibraryDialog />
        </div>
      ) : (
        <ul className="space-y-3">
          {repos.map((library) => (
            <li key={library.id}>
              <Link href={`/libraries/${library.slug}`} className="block">
                <Card className="transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle className="font-mono text-base">{library.slug}</CardTitle>
                    <CardDescription>
                      {library.name}
                      {library.github_repos.length > 0
                        ? ` · ${library.github_repos.slice(0, 2).join(", ")}${
                            library.github_repos.length > 2
                              ? ` 외 ${library.github_repos.length - 2}`
                              : ""
                          }`
                        : ""}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
