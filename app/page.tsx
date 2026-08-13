/**
 * @file app/page.tsx
 * @description 접근 가능한 레포 목록 (T-501).
 *
 * 미등록 이메일은 여기서 빈 화면을 본다 — 로그인은 되지만 아무것도 안 보이는 게 맞다 (P3).
 */
import Link from "next/link";

import { signInWithGoogle } from "@/actions/session";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessibleRepos, getSessionEmail } from "@/lib/authz";

export default async function HomePage() {
  const email = await getSessionEmail();

  if (!email) {
    return (
      <main className="mx-auto w-full max-w-3xl space-y-3 p-8">
        <h1 className="text-xl font-semibold">Cushion</h1>
        <p className="text-sm text-muted-foreground">
          스펙 읽기 전용 미러. 보려면 로그인이 필요하다.
        </p>
        <form action={signInWithGoogle}>
          <Button type="submit">Google로 로그인</Button>
        </form>
      </main>
    );
  }

  const repos = await getAccessibleRepos(email);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">레포</h1>
        <p className="text-sm text-muted-foreground">
          문서 원본은 각 레포의 git이다. 여기는 거울이라 고칠 수 없다.
        </p>
      </header>

      {repos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          접근 가능한 레포가 없다. 관리자에게 멤버 등록을 요청할 것.
        </p>
      ) : (
        <ul className="space-y-3">
          {repos.map((repo) => (
            <li key={repo.id}>
              <Link href={`/${repo.slug}`} className="block">
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
