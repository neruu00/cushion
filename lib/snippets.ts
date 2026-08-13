/**
 * @file lib/snippets.ts
 * @description 레포 등록 직후 화면에 뿌리는 붙여넣기용 설정 파일 (T-202).
 *              별도 설치 가이드 문서를 만들지 않기 위해 존재한다.
 */

/**
 * 앱의 공개 base URL.
 *
 * NextAuth는 `NEXTAUTH_URL` 없이도 요청 호스트로 잘 돈다. 그래서 배포할 때 이 값을
 * 빠뜨려도 로그인은 멀쩡하고 **여기서 만드는 스니펫만 조용히 `localhost`가 된다** —
 * 화면은 정상으로 보이는데 팀원에게 나눠 준 연결 명령이 아무 데서도 안 되는 식이다.
 * 그래서 Vercel이 늘 넣어 주는 배포 도메인을 두 번째 후보로 둔다.
 */
function baseUrl(): string {
  const explicit = process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

/**
 * 발급 직후 1회만 보여주는 연결 명령. **여기엔 토큰을 직접 넣는다** —
 * `claude mcp add`가 쓰는 파일(`~/.claude.json`)은 커밋되지 않기 때문이다.
 * 커밋되는 `.mcp.json`에는 절대 박지 않는다 (SPEC §7).
 *
 * 한 줄로 낸다. 백슬래시 줄바꿈은 PowerShell·cmd에서 깨진다 —
 * 큰따옴표 하나만 쓰면 bash·PowerShell·cmd 셋 다에 그대로 붙는다.
 */
export function connectCommand(token: string): string {
  return `claude mcp add --transport http --scope user cushion ${baseUrl()}/api/mcp --header "Authorization: Bearer ${token}"\n`;
}

/** `.mcp.json`은 커밋되므로 토큰을 박지 않는다. 환경변수 확장을 쓴다. (SPEC §7) */
function mcpJson(): string {
  return `${JSON.stringify(
    {
      mcpServers: {
        cushion: {
          type: "http",
          url: `${baseUrl()}/api/mcp`,
          headers: { Authorization: "Bearer ${CUSHION_TOKEN}" },
        },
      },
    },
    null,
    2,
  )}\n`;
}

/**
 * 툴이 있다고 에이전트가 쓰는 게 아니다. 이 3줄이 없으면 그냥 로컬 파일을 읽는다. (SPEC §7)
 */
function agentsSnippet(): string {
  return `## 스펙

이 프로젝트의 스펙 문서는 레포가 아니라 Cushion에 있다. MCP 서버 \`cushion\`으로 읽고 쓴다.
\`spec_outline\`으로 목차를 먼저 보고 필요한 섹션만 \`spec_get\`으로 가져온다.
응답에 \`[stale]\`이 보이면 \`spec_changes_since\`를 부른다.
고칠 때는 \`spec_get\`으로 받은 sha를 \`spec_put\`의 \`base_sha\`에 그대로 넘긴다.
`;
}

export function setupFiles(): { name: string; content: string }[] {
  return [
    // 개인 연결은 /settings/tokens의 명령 한 줄이면 끝난다. 이 파일까지 두면
    // 프로젝트 스코프가 user 스코프를 덮어 `CUSHION_TOKEN` 없이는 그 안에서만 401이 난다.
    {
      name: ".mcp.json — 팀 전체에 배포할 때만. 개인은 /settings/tokens 명령 한 줄로 충분하다",
      content: mcpJson(),
    },
    { name: "AGENTS.md 에 덧붙일 것", content: agentsSnippet() },
  ];
}
