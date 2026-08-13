/**
 * @file app/admin/page.tsx
 * @description 레포 등록 · sync 토큰 재발급 · 멤버 관리. admin 전용 (T-201, T-202).
 *
 * proxy.ts는 로그인 여부만 본다. admin 판정은 여기서 한다.
 */
import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";

import {
  addMember,
  createRepository,
  regenerateSyncToken,
  removeMember,
} from "@/actions/repository";
import { ActionForm } from "@/components/ActionForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAdmin } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

interface RepoRow {
  id: string;
  slug: string;
  name: string;
  github_full_name: string | null;
  mattermost_webhook_url: string | null;
  repository_members: { email: string }[];
}

export default async function AdminPage() {
  // admin이 아니면 404. 403은 "그런 화면이 있다"를 알려준다.
  if (!(await isAdmin())) notFound();

  const { data, error } = await supabase
    .from("repositories")
    .select("id, slug, name, github_full_name, mattermost_webhook_url, repository_members(email)")
    .order("slug");

  if (error) console.error("AdminPage", error);
  const repos: RepoRow[] = data ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">관리</h1>
        <p className="text-sm text-muted-foreground">
          레포를 등록하면 sync 토큰과 붙여넣을 설정 파일이 그 자리에서 한 번 나온다.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>레포 등록</CardTitle>
          <CardDescription>slug는 소문자·숫자·하이픈. 나머지는 나중에 채워도 된다.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createRepository}
            submitLabel="등록"
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field name="slug" label="slug" placeholder="cushion" required />
            <Field name="name" label="이름" placeholder="Cushion" required />
            <Field name="github_full_name" label="GitHub (org/repo)" placeholder="neruu00/cushion" />
            <Field
              name="mattermost_webhook_url"
              label="Mattermost webhook"
              placeholder="https://…/hooks/…"
            />
          </ActionForm>
        </CardContent>
      </Card>

      {repos.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 레포가 없다.</p>
      ) : (
        repos.map((repo) => (
          <Card key={repo.id}>
            <CardHeader>
              <CardTitle className="font-mono text-base">{repo.slug}</CardTitle>
              <CardDescription>
                {repo.name}
                {repo.github_full_name ? ` · ${repo.github_full_name}` : ""}
                {repo.mattermost_webhook_url ? " · webhook 설정됨" : " · webhook 없음"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <section className="space-y-2">
                <h2 className="text-sm font-medium">멤버</h2>
                {repo.repository_members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    없음 — 등록 전까지 admin 외에는 아무도 못 본다.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {repo.repository_members.map((member) => (
                      <li
                        key={member.email}
                        className="flex items-center justify-between gap-2 px-3 py-1.5"
                      >
                        <span className="truncate font-mono text-sm">{member.email}</span>
                        <form action={removeMember}>
                          <input type="hidden" name="repository_id" value={repo.id} />
                          <input type="hidden" name="email" value={member.email} />
                          <Button
                            type="submit"
                            variant="destructive"
                            size="xs"
                            aria-label={`${member.email} 삭제`}
                          >
                            <Trash2 />
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}

                <ActionForm action={addMember} submitLabel="추가">
                  <input type="hidden" name="repository_id" value={repo.id} />
                  <Field name="email" label="이메일" type="email" placeholder="teammate@example.com" required />
                </ActionForm>
              </section>

              <section className="space-y-2">
                <h2 className="text-sm font-medium">sync 토큰</h2>
                <p className="text-sm text-muted-foreground">
                  재발급하면 기존 토큰이 즉시 죽는다. CI Secret을 같이 갱신할 것.
                </p>
                <ActionForm action={regenerateSyncToken} submitLabel="재발급">
                  <input type="hidden" name="repository_id" value={repo.id} />
                </ActionForm>
              </section>
            </CardContent>
          </Card>
        ))
      )}
    </main>
  );
}

interface FieldProps {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}

// 같은 name의 필드가 레포 카드마다 반복되므로 id를 쓰지 않는다.
// label로 감싸면 id 없이도 연결된다 — 중복 id를 만들 여지가 아예 없어진다.
function Field({ name, label, placeholder, type = "text", required }: FieldProps) {
  return (
    <Label className="grid gap-1.5">
      <span>{label}</span>
      <Input name={name} type={type} placeholder={placeholder} required={required} />
    </Label>
  );
}
