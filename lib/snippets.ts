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

/**
 * Claude Code 플러그인 저장소. 마켓플레이스는 배포 도메인이 아니라 **GitHub 레포**에서
 * 오므로 `baseUrl()`로 만들 수 없는 유일한 스니펫이다. 레포를 옮기면 여기도 옮긴다.
 * 매니페스트는 `.claude-plugin/`에 있다.
 */
const PLUGIN_REPO = "neruu00/cushion";

/**
 * Claude Code 플러그인 설치. 이 두 줄이 아래 ①(연결)과 ②(스킬 설치)를 한꺼번에 한다 —
 * 플러그인이 MCP 서버 설정과 스킬 전부를 함께 들고 오기 때문이다.
 *
 * **여기엔 토큰을 넣지 않는다.** `plugin install`이 설치 중에 물어보고 Claude Code의
 * 보안 저장소에 넣으므로 평문 설정 파일에 남지 않는다 — `connectCommand`보다
 * 이쪽이 안전한 이유고, 그래서 발급 직후가 아니어도 화면에 그냥 둘 수 있다.
 */
export function pluginCommands(): string {
  return `/plugin marketplace add ${PLUGIN_REPO}\n/plugin install cushion@cushion\n`;
}

export function connectCommand(token: string): string {
  return `claude mcp add --transport http --scope user cushion ${baseUrl()}/api/mcp --header "Authorization: Bearer ${token}"\n`;
}

/**
 * Antigravity(`.agents/mcp_config.json` 또는 `~/.gemini/config/mcp_config.json`)는
 * `url`이 아니라 `serverUrl`을 쓴다 — Claude·Cursor류와 키 이름이 다르다.
 * 공식 문서: https://antigravity.google/docs/mcp
 *
 * 토큰을 그대로 박는다 — `headers`가 `${VAR}` 환경변수 치환을 지원하는지 문서로
 * 확인이 안 돼서 `.mcp.json`처럼 시크릿을 뺄 수 없다. 그래서 이 함수의 결과는
 * **저장소 밖(전역, `~/.gemini/config/mcp_config.json`) 경로에만** 써야 한다 — 저장소 안
 * 경로(`.agents/mcp_config.json`)에 쓰면 토큰이 그대로 커밋될 위험이 있다.
 */
export function antigravityConfig(token: string): string {
  return `${JSON.stringify(
    {
      mcpServers: {
        cushion: {
          serverUrl: `${baseUrl()}/api/mcp`,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  )}\n`;
}

/**
 * Codex CLI(`~/.codex/config.toml`)는 `bearer_token_env_var`로 **환경변수 이름**만 받는다
 * (토큰 리터럴을 직접 받는 필드는 공식 문서가 권장하지 않는다) — 그래서 export 줄과
 * toml 블록을 별도 파일로 나눈다. `.mcp.json`과 같은 변수 이름(`CUSHION_TOKEN`)을 써서
 * 하나만 기억하면 되게 한다. 공식 문서: https://learn.chatgpt.com/docs/extend/mcp
 */
export function codexEnvExport(token: string): string {
  return `export CUSHION_TOKEN="${token}"\n`;
}

export function codexConfig(): string {
  return `[mcp_servers.cushion]\nurl = "${baseUrl()}/api/mcp"\nbearer_token_env_var = "CUSHION_TOKEN"\n`;
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
function agentsSnippet(slug: string, t: SnippetCopy): string {
  return `## ${t.agentsHeading}

${t.agentsBody.replace("{slug}", slug)}
`;
}

/**
 * 문구는 호출부(서버 액션)가 요청 언어로 골라 넘긴다.
 *
 * `@/lib/i18n.en`의 `Dict`를 직접 가져오지 않고 구조로 받는 이유: 이 파일은 `node --test`가
 * 확장자까지 쓴 상대 경로로 직접 실행하는 순수 모듈이라 `@/` 별칭을 모른다 (D-008).
 *
 * ⚠️ 이 스니펫은 **사람이 자기 레포에 커밋하는 파일**이다. 에이전트가 읽는 텍스트지만
 *    영어로 고정하지 않는다 — 한국어 팀의 `AGENTS.md`에 영어 문단이 끼어들 이유가 없고,
 *    복사하는 사람이 곧 그 레포의 주인이라 그 사람의 언어가 맞다.
 */
export interface SnippetCopy {
  mcpJsonName: string;
  agentsName: string;
  agentsHeading: string;
  /** `{slug}` 자리표시자를 쓴다 */
  agentsBody: string;
}

export function setupFiles(slug: string, t: SnippetCopy): { name: string; content: string }[] {
  return [
    // 개인 연결은 /settings/tokens의 온보딩(붙여넣기 두 번)이면 끝난다. 이 파일까지 두면
    // 프로젝트 스코프가 user 스코프를 덮어 `CUSHION_TOKEN` 없이는 그 안에서만 401이 난다.
    { name: t.mcpJsonName, content: mcpJson() },
    { name: t.agentsName, content: agentsSnippet(slug, t) },
  ];
}
