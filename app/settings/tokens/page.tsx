/**
 * @file app/settings/tokens/page.tsx
 * @description 개인 access token 발급·폐기 (T-203). 발급 직후 1회만 값이 보인다.
 */
import { notFound } from "next/navigation";

import { createAccessToken, revokeAccessToken } from "@/actions/token";
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

/** timestamptz → YYYY-MM-DD. 로케일 포맷은 서버·클라이언트가 갈릴 수 있어 쓰지 않는다. */
function day(value: string | null): string {
  return value ? value.slice(0, 10) : "—";
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
    <main className="mx-auto w-full max-w-3xl space-y-8 p-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">access token</h1>
        <p className="text-sm text-muted-foreground">
          에이전트가 MCP로 붙을 때 쓴다. 권한은 토큰이 아니라 <code>{email}</code> 에 붙어 있어서,
          멤버에서 빠지면 재발급 없이 바로 막힌다.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>새 토큰</CardTitle>
          <CardDescription>이름은 어디에 꽂았는지 나중에 알아보려고 쓴다.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={createAccessToken} submitLabel="발급">
            <Label className="grid gap-1.5">
              <span>이름</span>
              <Input name="name" placeholder="노트북 Claude Code" />
            </Label>
          </ActionForm>
        </CardContent>
      </Card>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">발급한 토큰이 없다.</p>
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
    </main>
  );
}
