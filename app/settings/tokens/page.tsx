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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Fill } from "@/components/Fill";
import { getDict } from "@/lib/i18n";
import { fill } from "@/lib/utils";
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
  const t = await getDict();

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
        title={t.tokens.title}
        description={
          <Fill template={t.tokens.description} parts={{ email: <code>{email}</code> }} />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t.tokens.stepsTitle}</CardTitle>
          <CardDescription>{t.tokens.stepsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingSteps
            skillsUrl={skillsUrl()}
            connectSlot={
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t.tokens.issueHelp}</p>
                <ActionForm
                  action={createAccessToken}
                  submitLabel={t.tokens.issue}
                  filesLayout="tabs"
                >
                  <Label className="grid gap-1.5">
                    <span>{t.common.name}</span>
                    <Input name="name" placeholder={t.tokens.namePlaceholder} />
                  </Label>
                </ActionForm>
              </div>
            }
          />
        </CardContent>
      </Card>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.tokens.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>{t.tokens.colIssued}</TableHead>
              <TableHead>{t.tokens.colLastUsed}</TableHead>
              <TableHead className="text-right">{t.common.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell>{token.name ?? t.tokens.unnamed}</TableCell>
                <TableCell className="text-muted-foreground">{day(token.created_at)}</TableCell>
                <TableCell className="text-muted-foreground">{day(token.last_used_at)}</TableCell>
                <TableCell className="text-right">
                  {token.revoked_at ? (
                    <span className="text-muted-foreground">
                      {fill(t.tokens.revoked, { date: day(token.revoked_at) })}
                    </span>
                  ) : (
                    <form action={revokeAccessToken}>
                      <input type="hidden" name="id" value={token.id} />
                      <Button type="submit" variant="destructive" size="xs">
                        {t.tokens.revoke}
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
