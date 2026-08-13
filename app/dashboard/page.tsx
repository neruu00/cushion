/**
 * @file app/dashboard/page.tsx
 * @description 내 레포 목록 + 레포 만들기 (D-013).
 *
 * 절약 추정은 여기 두지 않는다 — 레포에 들어가면 보인다. 목록 화면이 전 레포의
 * 문서 본문을 읽어야 하는 건 목록이 할 일이 아니다.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { createRepository } from "@/actions/repository";
import { ActionForm } from "@/components/ActionForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccessibleRepos, getSessionEmail } from "@/lib/authz";

export default async function DashboardPage() {
  const email = await getSessionEmail();
  if (!email) redirect("/api/auth/signin?callbackUrl=%2Fdashboard");

  const repos = await getAccessibleRepos(email);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">대시보드</h1>
        <p className="text-sm text-muted-foreground">
          문서 원본은 Cushion에 있다. 여기서 만들고, 에이전트는 MCP로 읽고 쓴다.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>새 레포</CardTitle>
          <CardDescription>
            slug는 소문자·숫자·하이픈. 만든 사람이 첫 멤버가 되고, 멤버는 레포 화면에서
            초대한다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createRepository}
            submitLabel="만들기"
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field name="slug" label="slug" placeholder="my-project" required />
            <Field name="name" label="이름" placeholder="My Project" required />
            <Field name="github_full_name" label="관련 GitHub (org/repo, 선택)" placeholder="org/repo" />
            <Field
              name="mattermost_webhook_url"
              label="Mattermost webhook (선택)"
              placeholder="https://…/hooks/…"
            />
          </ActionForm>
        </CardContent>
      </Card>

      {repos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          아직 레포가 없다. 위에서 만들거나, 팀원에게 초대를 부탁할 것.
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

interface FieldProps {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

// 같은 name의 필드가 반복될 수 있어 id 대신 label로 감싼다 — 중복 id의 여지를 없앤다.
function Field({ name, label, placeholder, required }: FieldProps) {
  return (
    <Label className="grid gap-1.5">
      <span>{label}</span>
      <Input name={name} placeholder={placeholder} required={required} />
    </Label>
  );
}
