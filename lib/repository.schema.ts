/**
 * @file lib/repository.schema.ts
 * @description /admin 폼 입력 검증. formData는 외부 입력이므로 `as`가 아니라 여기를 지난다.
 */
import { z } from "zod";

/**
 * 웹훅 URL. 안 채운 칸은 ''로 오고 아예 없으면 undefined다 — 둘 다 null로 접는다(DB에 ''를 넣지 않는다).
 * 형태를 여기서 본다 — 틀린 값은 저장 시점엔 조용하고, 알림을 보낼 때가 돼서야
 * 실패하는데 그 실패는 서버 로그에만 남는다(편집은 성공한다). 그때는 아무도 모른다.
 */
const webhookUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || null)
  .pipe(z.url("웹훅은 https:// 로 시작하는 URL이어야 합니다.").nullable());

/**
 * `org/repo`만 저장한다. 클론 URL을 그대로 붙여넣는 일이 잦은데, 그러면 문서 화면의
 * 원본 링크가 `https://github.com/https://github.com/org/repo.git/blob/HEAD/...`가 된다 —
 * 저장할 땐 아무 소리도 안 나고 링크를 눌러야 알게 된다. 여기서 접고, 형태도 확인한다.
 */
const githubFullName = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    const trimmed = (value ?? "")
      .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
      .replace(/\.git$/i, "")
      .replace(/\/+$/, "");
    return trimmed || null;
  })
  .pipe(
    z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/, "GitHub은 org/repo 형태로 입력하세요.")
      .nullable(),
  );

export const createRepositorySchema = z.object({
  // 0001_schema.sql의 repositories_slug_format CHECK와 같은 규칙. 어긋나면 DB가 거부한다.
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "slug는 소문자·숫자·하이픈만 쓸 수 있습니다."),
  name: z.string().trim().min(1, "이름을 입력하세요.").max(100),
  github_full_name: githubFullName,
  // 둘 다 둘 수 있다. 페이로드 키가 달라서(text vs content) 한 칸으로 합치지 않는다.
  mattermost_webhook_url: webhookUrl,
  discord_webhook_url: webhookUrl,
});

/**
 * 이미 만든 레포의 웹훅 갱신. 두 칸이 늘 함께 오므로 **빈 칸 = 연결 해제**다 —
 * "안 보냈다"와 "지웠다"를 구분할 필요가 없어진다.
 */
export const webhooksSchema = z.object({
  repository_id: z.uuid(),
  mattermost_webhook_url: webhookUrl,
  discord_webhook_url: webhookUrl,
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

