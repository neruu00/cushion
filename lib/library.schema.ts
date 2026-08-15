/**
 * @file lib/library.schema.ts
 * @description 라이브러리 폼 입력 검증. formData는 외부 입력이므로 `as`가 아니라 여기를 지난다.
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
  .pipe(z.url("웹훅은 https:// 로 시작하는 URL이어야 해요.").nullable());

/**
 * 이 라이브러리를 보는 GitHub 레포들. **여러 개인 게 기본이다** — FE·BE 레포가 API 계약
 * 문서 하나를 같이 보는 게 이 도구의 창립 유스케이스다.
 *
 * `org/*`는 그 조직 전체를 뜻한다. 조직에 레포가 30개면 한 줄로 끝나고, `org` 컬럼을
 * 따로 두는 것보다 낫다 — 별도 컬럼이면 org를 걸치는 경우(사내 org + 개인 레포)에
 * 같은 1:1 문제가 한 층 위에서 되풀이되고, 두 칸이 어긋나면 어느 쪽이 이기는지도 정해야 한다.
 *
 * 클론 URL을 그대로 붙여넣는 일이 잦아서 항목마다 접는다. 안 그러면 링크가
 * `https://github.com/https://github.com/org/repo.git`가 되는데, 저장할 땐 조용하고
 * 눌러야 알게 된다.
 */
const ONE_REPO = /^[\w.-]+\/(?:\*|[\w.-]+)$/;

const githubRepos = z
  .string()
  .trim()
  .optional()
  .transform((value) =>
    (value ?? "")
      // 줄바꿈·콤마·공백 아무거나 구분자로 받는다. 붙여넣는 사람이 고르게 하지 않는다.
      .split(/[\s,]+/)
      .map((item) =>
        item
          .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
          .replace(/\.git$/i, "")
          .replace(/\/+$/, ""),
      )
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.string().regex(ONE_REPO, "GitHub은 org/repo 또는 org/* 형태로 입력하세요."))
      .max(50, "GitHub 레포는 50개까지입니다."),
  );

/** `org/*`가 있으면 그 조직 전체가 일치한다. 매칭 규칙은 이 함수 하나뿐이다. */
export function matchesGithubRepo(patterns: string[], fullName: string): boolean {
  const wanted = fullName.trim().toLowerCase();
  const org = wanted.split("/")[0];
  return patterns.some((p) => {
    const pattern = p.toLowerCase();
    return pattern === wanted || pattern === `${org}/*`;
  });
}

export const createLibrarySchema = z.object({
  // 0001_schema.sql의 libraries_slug_format CHECK와 같은 규칙. 어긋나면 DB가 거부한다.
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, "slug는 소문자·숫자·하이픈만 쓸 수 있습니다."),
  name: z.string().trim().min(1, "이름을 입력하세요.").max(100),
  github_repos: githubRepos,
  // 둘 다 둘 수 있다. 페이로드 키가 달라서(text vs content) 한 칸으로 합치지 않는다.
  mattermost_webhook_url: webhookUrl,
  discord_webhook_url: webhookUrl,
});

/**
 * 이미 만든 라이브러리의 설정 갱신. 칸이 늘 함께 오므로 **빈 칸 = 지움**이다 —
 * "안 보냈다"와 "지웠다"를 구분할 필요가 없어진다.
 *
 * slug는 여기 없다. 바꾸는 순간 팀원의 URL과 에이전트가 쓰던 `library` 인자가 죽는다.
 */
export const librarySettingsSchema = z.object({
  library_id: z.uuid(),
  name: z.string().trim().min(1, "이름을 입력하세요.").max(100),
  github_repos: githubRepos,
  mattermost_webhook_url: webhookUrl,
  discord_webhook_url: webhookUrl,
});

export const memberSchema = z.object({
  library_id: z.uuid(),
  // 대소문자 차이가 곧 ACL 우회 구멍이다. 검증 **전에** 정규화해야 폼에서 붙어온
  // 공백·대문자가 그대로 DB CHECK(email = lower(email))에 부딪히지 않는다. (SPEC §6)
  email: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.email("이메일 형식이 아니에요.")),
});

