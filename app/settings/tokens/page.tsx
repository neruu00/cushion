/**
 * @file app/settings/tokens/page.tsx
 * @description 개인 access token 발급·폐기 (T-203). 발급 직후 1회만 값이 보인다.
 */
import { notFound } from "next/navigation";

import { formatDate } from "@/lib/datetime";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { createAccessToken, revokeAccessToken } from "@/actions/token";
import { ActionForm } from "@/components/ActionForm";
import { OnboardingSteps } from "@/components/OnboardingSteps";
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
import { skillsUrl } from "@/lib/snippets";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSessionEmail } from "@/lib/authz";
import { supabase } from "@/lib/supabase";

interface TokenRow {
  id: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/** timestamptz → YYYY-MM-DD. 없으면 대시. 변환은 `lib/datetime.ts`가 한다 —
 *  로케일·타임존을 명시하지 않으면 서버·클라이언트가 갈린다. */
function day(value: string | null): string {
  return value ? formatDate(value) : "—";
}

export default async function TokensPage() {
  // proxy.ts가 이미 막지만, 그건 UX용이다. 여기서도 본다.
  const email = await getSessionEmail();
  if (!email) notFound();

  const { data, error } = await supabase
    .from("access_tokens")
    .select("id, name, created_at, last_used_at, revoked_at")
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (error) console.error("TokensPage", error);
  const tokens: TokenRow[] = data ?? [];

  return (
    <PageShell className="space-y-8">
      <PageHeader
        title="access token"
        description={
          <>
            에이전트가 MCP로 연결할 때 써요. 권한은 토큰이 아니라 <code>{email}</code> 에 붙어
            있어서, 멤버에서 빠지면 재발급 없이 바로 막혀요.
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>연결하는 순서</CardTitle>
          <CardDescription>
            세 단계예요. ①만 해도 에이전트가 문서를 읽고 써요 — ②는 사용법을 깊게 알려 주고,
            ③은 <strong>다음 세션부터 알아서 찾게</strong> 만들어요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingSteps
            skillsUrl={skillsUrl()}
            connectSlot={
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  발급하면 토큰이 포함된 명령이 같이 나와요. 아무 디렉터리에서 한 번 실행하면 끝
                  — 레포를 클론할 필요도, 환경변수를 설정할 필요도 없어요. 토큰은{" "}
                  <code>~/.claude.json</code> 에 평문으로 남아요(환경변수를 dotfile에 두는 것과
                  같은 수준이에요). 유출되면 재발급하세요 — 그 즉시 이전 토큰은 무효가 돼요.
                </p>
                <ActionForm action={createAccessToken} submitLabel="발급">
                  <Label className="grid gap-1.5">
                    <span>이름</span>
                    <Input name="name" placeholder="노트북 Claude Code" />
                  </Label>
                </ActionForm>
              </div>
            }
          />
        </CardContent>
      </Card>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 발급한 토큰이 없어요.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>발급</TableHead>
              <TableHead>마지막 사용</TableHead>
              <TableHead className="text-right">상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell>{token.name ?? "(이름 없음)"}</TableCell>
                <TableCell className="text-muted-foreground">{day(token.created_at)}</TableCell>
                <TableCell className="text-muted-foreground">{day(token.last_used_at)}</TableCell>
                <TableCell className="text-right">
                  {token.revoked_at ? (
                    <span className="text-muted-foreground">{day(token.revoked_at)} 폐기</span>
                  ) : (
                    <form action={revokeAccessToken}>
                      <input type="hidden" name="id" value={token.id} />
                      <Button type="submit" variant="destructive" size="xs">
                        폐기
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageShell>
  );
}
