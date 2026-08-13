/**
 * @file lib/snippets.ts
 * @description 레포 등록 직후 화면에 뿌리는 붙여넣기용 설정 파일 (T-202).
 *              별도 설치 가이드 문서를 만들지 않기 위해 존재한다.
 */

/** 앱의 공개 base URL. 배포 도메인이 정해지면 NEXTAUTH_URL 하나만 바꾸면 된다. */
function baseUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * ponytail: 이 워크플로가 /api/sync의 페이로드 계약이다. 수신부(T-301)를 이 모양에 맞춰 쓰고,
 * 실제 push로 검증하는 건 T-303이다. 어긋나면 여기가 아니라 둘 중 하나가 틀린 것이다.
 */
function syncWorkflow(): string {
  return `name: cushion-sync

on:
  push:
    paths:
      - '.specs/**'
      - 'AGENTS.md'
      - 'CLAUDE.md'
  workflow_dispatch: {}     # 전체 동기화 (신규 등록 직후 1회 실행할 것)

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0    # diff를 뜨려면 히스토리가 필요하다

      - name: 스펙 변경 수집 후 Cushion으로 전송
        env:
          CUSHION_URL: ${baseUrl()}
          CUSHION_SYNC_TOKEN: \${{ secrets.CUSHION_SYNC_TOKEN }}
          BEFORE: \${{ github.event.before }}
          EVENT: \${{ github.event_name }}
          # 커밋 메시지를 run 안에 직접 보간하면 스크립트 인젝션이 된다. 환경변수로 받는다.
          AUTHOR: \${{ github.event.head_commit.author.name || github.actor }}
          MESSAGE: \${{ github.event.head_commit.message || '' }}
        run: |
          set -euo pipefail
          SPEC='^(\\.specs/|AGENTS\\.md$|CLAUDE\\.md$)'

          # before가 all-zeros면 신규 브랜치/force push다. HEAD~1로 대체하지 않는다
          # — 한 push에 커밋이 여러 개일 수 있다. 전체 스냅샷으로 폴백한다.
          if [ "$EVENT" = "workflow_dispatch" ] || [ -z "\${BEFORE//0/}" ]; then
            FULL=true
          else
            FULL=false
          fi

          if [ "$FULL" = true ]; then
            git ls-files | grep -E "$SPEC" > changed.txt || true
            : > deleted.txt
            : > diff.txt
          else
            git diff --name-only --diff-filter=d "$BEFORE" "$GITHUB_SHA" | grep -E "$SPEC" > changed.txt || true
            # 삭제 동기화. 이걸 빠뜨리면 에이전트가 지워진 스펙을 계속 읽는다.
            git diff --name-only --diff-filter=D "$BEFORE" "$GITHUB_SHA" | grep -E "$SPEC" > deleted.txt || true
            git diff "$BEFORE" "$GITHUB_SHA" -- '.specs' AGENTS.md CLAUDE.md > diff.txt || true
          fi

          # 페이로드 상한. 알림 하나가 토큰을 태우면 본말전도다.
          TRUNCATED=false
          if [ "$(wc -c < diff.txt)" -gt 40000 ]; then
            head -c 40000 diff.txt > diff.trim && mv diff.trim diff.txt
            TRUNCATED=true
          fi

          while IFS= read -r p; do
            [ -n "$p" ] || continue
            jq -n --arg path "$p" --rawfile content "$p" '{path: $path, content: $content}'
          done < changed.txt | jq -s '.' > changed.json

          jq -n \\
            --argjson full "$FULL" \\
            --argjson truncated "$TRUNCATED" \\
            --arg sha "$GITHUB_SHA" \\
            --arg author "$AUTHOR" \\
            --arg message "$MESSAGE" \\
            --rawfile diff diff.txt \\
            --rawfile deletedRaw deleted.txt \\
            --slurpfile changed changed.json \\
            '{
               full: $full,
               truncated: $truncated,
               commit: { sha: $sha, author: $author, message: $message },
               changed: $changed[0],
               deleted: ($deletedRaw | split("\\n") | map(select(length > 0))),
               diff: $diff
             }' > payload.json

          curl -sS --fail-with-body -X POST "$CUSHION_URL/api/sync" \\
            -H "Authorization: Bearer $CUSHION_SYNC_TOKEN" \\
            -H 'Content-Type: application/json' \\
            --data-binary @payload.json
`;
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
  return `## 스펙 조회

로컬 \`.specs/**\`를 통째로 읽지 말 것. MCP 서버 \`cushion\`이 같은 내용을 조각으로 준다.
\`spec_outline\`으로 목차를 먼저 보고 필요한 섹션만 \`spec_get\`으로 가져온다.
응답에 \`[stale]\`이 보이면 \`spec_changes_since\`를 부른다.
`;
}

export function setupFiles(): { name: string; content: string }[] {
  return [
    { name: ".github/workflows/cushion-sync.yml", content: syncWorkflow() },
    { name: ".mcp.json", content: mcpJson() },
    { name: "AGENTS.md 에 덧붙일 것", content: agentsSnippet() },
  ];
}
