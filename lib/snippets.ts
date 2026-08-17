/**
 * @file lib/snippets.ts
 * @description 레포 등록 직후 화면에 뿌리는 붙여넣기용 설정 파일 (T-202).
 *              별도 설치 가이드 문서를 만들지 않기 위해 존재한다.
 */
// `@/` 별칭이 아니라 확장자까지 쓴 상대 경로다. 이 파일은 `node --test`가 직접 실행하는
// 순수 모듈이고, plain Node는 tsconfig의 paths를 모른다 (D-008).
import { baseUrl } from "./url.ts";

/**
 * 발급 직후 1회만 보여주는 연결 명령. **여기엔 토큰을 직접 넣는다** —
 * `claude mcp add`가 쓰는 파일(`~/.claude.json`)은 커밋되지 않기 때문이다.
 * 커밋되는 `.mcp.json`에는 절대 박지 않는다 (SPEC §7).
 *
 * 한 줄로 낸다. 백슬래시 줄바꿈은 PowerShell·cmd에서 깨진다 —
 * 큰따옴표 하나만 쓰면 bash·PowerShell·cmd 셋 다에 그대로 붙는다.
 */
/** 스킬 매니페스트 주소. 배포 도메인을 화면에 박지 않기 위해 여기서 만든다. */
export function skillsUrl(): string {
  return `${baseUrl()}/api/skills`;
}

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
/**
 * `AGENTS.md`에 남길 **한 줄**. 사용법 전문은 `cushion` 스킬에 있다 (D-016).
 *
 * 이 한 줄이 유일한 방아쇠다 — 로컬에 문서가 없는 게 이 구조의 정상 상태라,
 * 이게 없으면 에이전트는 "문서가 없네" 하고 그냥 지나간다.
 */
function agentsSnippet(slug: string): string {
  return `## 문서

이 프로젝트의 문서(스펙·ADR·런북·회의록 등)는 레포가 아니라 Cushion의 \`${slug}\` 라이브러리에 있다.
MCP 서버 \`cushion\`의 \`doc_*\` 툴로 읽고 쓴다. 사용법은 \`cushion\` 스킬에 있다.
`;
}

export function setupFiles(slug: string): { name: string; content: string }[] {
  return [
    // 개인 연결은 /settings/tokens의 온보딩(붙여넣기 두 번)이면 끝난다. 이 파일까지 두면
    // 프로젝트 스코프가 user 스코프를 덮어 `CUSHION_TOKEN` 없이는 그 안에서만 401이 난다.
    {
      name: ".mcp.json — 팀 전체에 배포할 때만. 개인은 /settings/tokens 온보딩으로 충분하다",
      content: mcpJson(),
    },
    { name: "AGENTS.md 에 덧붙일 것 — 이 한 줄이 방아쇠다", content: agentsSnippet(slug) },
  ];
}
