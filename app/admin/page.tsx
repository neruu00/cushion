/**
 * @file app/admin/page.tsx
 * @description 레포 등록 · 멤버 관리 · 전체 내보내기. admin 전용.
 *
 * proxy.ts는 로그인 여부만 본다. admin 판정은 여기서 한다.
 */
import { Trash2 } from "lucide-react";
import { notFound } from "next/navigation";

import { addMember, removeMember } from "@/actions/library";
import { ActionForm } from "@/components/ActionForm";
import { Field } from "@/components/Field";
import { NewLibraryDialog } from "@/components/NewLibraryDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isAdmin } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

interface LibraryRow {
  id: string;
  slug: string;
  name: string;
  github_repos: string[];
  mattermost_webhook_url: string | null;
  discord_webhook_url: string | null;
  library_members: { email: string }[];
}

export default async function AdminPage() {
  // admin이 아니면 404. 403은 "그런 화면이 있다"를 알려준다.
  if (!(await isAdmin())) notFound();

  const { data, error } = await supabase
    .from("libraries")
    .select(
      "id, slug, name, github_repos, mattermost_webhook_url, discord_webhook_url, library_members(email)",
    )
    .order("slug");

  if (error) console.error("AdminPage", error);
  const repos: LibraryRow[] = data ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">관리</h1>
        <p className="text-sm text-muted-foreground">
          레포를 등록하고 멤버를 넣는다. 문서는 각 레포 화면에서 만든다.{" "}
          {/* git이 없으므로 이게 유일한 백업이다 (D-011).
              라우트 핸들러가 파일을 내려주므로 <Link>의 클라이언트 이동으로는 다운로드가 안 된다. */}
          <a href="/api/export" className="underline underline-offset-4 hover:text-foreground">
            전체 내보내기
          </a>
        </p>
      </header>

      <NewLibraryDialog />

      {repos.length === 0 ? (
        <p className="text-sm text-muted-foreground">등록된 레포가 없다.</p>
      ) : (
        repos.map((repo) => (
          <Card key={repo.id}>
            <CardHeader>
              <CardTitle className="font-mono text-base">{repo.slug}</CardTitle>
              <CardDescription>
                {repo.name}
                {repo.github_repos.length > 0 ? ` · ${repo.github_repos.join(", ")}` : ""}
                {repo.mattermost_webhook_url ? " · Mattermost" : ""}
                {repo.discord_webhook_url ? " · Discord" : ""}
                {!repo.mattermost_webhook_url && !repo.discord_webhook_url ? " · webhook 없음" : ""}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <section className="space-y-2">
                <h2 className="text-sm font-medium">멤버</h2>
                {repo.library_members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    없음 — 등록 전까지 admin 외에는 아무도 못 본다.
                  </p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {repo.library_members.map((member) => (
                      <li
                        key={member.email}
                        className="flex items-center justify-between gap-2 px-3 py-1.5"
                      >
                        <span className="truncate font-mono text-sm">{member.email}</span>
                        <form action={removeMember}>
                          <input type="hidden" name="library_id" value={repo.id} />
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
                  <input type="hidden" name="library_id" value={repo.id} />
                  <Field name="email" label="이메일" type="email" placeholder="teammate@example.com" required />
                </ActionForm>
              </section>

            </CardContent>
          </Card>
        ))
      )}
    </main>
  );
}
