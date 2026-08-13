/**
 * @file lib/repository.schema.ts
 * @description /admin 폼 입력 검증. formData는 외부 입력이므로 `as`가 아니라 여기를 지난다.
 */
import { z } from "zod";

/** 안 채운 칸은 ''로 오고 아예 없으면 undefined다. 둘 다 null로 접는다 — DB에 ''를 넣지 않기 위해. */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null);

export const createRepositorySchema = z.object({
  // 0001_init.sql의 repositories_slug_format CHECK와 같은 규칙. 어긋나면 DB가 거부한다.
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "slug는 소문자·숫자·하이픈만 쓸 수 있습니다."),
  name: z.string().trim().min(1, "이름을 입력하세요.").max(100),
  github_full_name: optionalText,
  mattermost_webhook_url: optionalText,
});

export const memberSchema = z.object({
  repository_id: z.uuid(),
  // 대소문자 차이가 곧 ACL 우회 구멍이다. 검증 **전에** 정규화해야 폼에서 붙어온
  // 공백·대문자가 그대로 DB CHECK(email = lower(email))에 부딪히지 않는다. (SPEC §6)
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.email("이메일 형식이 아닙니다.")),
});

export const repositoryIdSchema = z.object({ repository_id: z.uuid() });
