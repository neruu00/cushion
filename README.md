# Cushion

> 쿠션이 완충해 토큰을 줄인다.

AI 스펙주도 개발용 **스펙 공유 계층**. 각 프로젝트 git 레포의 `.md`를 미러링해서
팀에는 변경 알림을 보내고, 에이전트에는 MCP로 **필요한 조각만** 준다.

목적은 하나 — 에이전트가 같은 문서를 반복해서 컨텍스트에 싣느라 태우는 토큰을 줄이는 것.

**이 레포 자신의 스펙 문서로 잰 값**: 전량 로드 대비 **20% 미만 — 5배 이상 절감**
(작업 3건 기준, 목차 1회 + 필요한 섹션 1개씩). 목차는 세션당 한 번이라 작업이 늘수록 더 벌어진다.

숫자를 여기 박아 두지 않는다 — 측정 대상이 이 레포의 문서라 문서가 자라면 같이 움직인다.
`pnpm acceptance`가 그때그때 다시 잰다. 방법은 `PLAN.md` T-601.

---

## 어떻게 동작하나

```
프로젝트 레포                    Cushion                        읽는 쪽
─────────────                  ─────────                      ────────
.specs/**  ─push→  GitHub Action ─POST /api/sync→  documents ─MCP→ 에이전트
AGENTS.md          (sync token)                    sync_events ─→ Mattermost
CLAUDE.md                                                      └─→ 웹 화면
```

**레포가 민다. Cushion이 GitHub을 당기지 않는다.** 그래서 Cushion은 GitHub 자격증명을
하나도 갖지 않는다. CI는 이미 파일을 체크아웃해 놨으니 그쪽이 보내는 게 싸다.

**원본은 git이다. 여기는 읽기 전용 거울이다.** 문서 수정은 각 프로젝트에서 PR로 한다.
편집 UI도 문서 쓰기 API도 없고, 앞으로도 만들지 않는다.

---

## 시작하기

필요한 것: Node 24+, pnpm, Supabase 프로젝트, Google OAuth 클라이언트.

```bash
pnpm install
cp .env.example .env.local     # 값을 채운다
```

`SUPABASE_SERVICE_ROLE_KEY`에는 **`service_role` 키**를 넣는다. anon 키를 넣으면
RLS 정책이 0개라 모든 읽기가 빈 결과, 모든 쓰기가 거부되는데 **에러 없이 조용하다.**
"화면이 비었다 / 아무 일도 안 일어난다"면 이 키부터 본다.

`supabase/migrations/0001_init.sql`을 Supabase SQL Editor에서 실행한다. 그다음:

```bash
pnpm dev
```

`ADMIN_EMAILS`에 든 이메일로 로그인하면 `/admin`이 열린다.

| 목적 | 명령 |
|---|---|
| 개발 서버 | `pnpm dev` |
| 전체 검증 | `pnpm verify` — 타입 + 린트 + 테스트 + 빌드 |
| 인수 검증 | `pnpm acceptance` — `SPEC.md` §11을 실 DB로 관통 (dev 서버 필요) |

---

## 레포 등록하기

`/admin`에서 레포를 만들면 그 자리에서 한 번만 보이는 **sync 토큰**과, 그대로 복사해 갈
`cushion-sync.yml` · `.mcp.json` · `AGENTS.md` 3줄이 같이 나온다. 별도 설치 가이드는 없다 —
그 화면이 가이드다.

프로젝트 레포에서 할 일:

1. `.github/workflows/cushion-sync.yml` 붙여넣기
2. GitHub Secret `CUSHION_SYNC_TOKEN`에 sync 토큰 넣기
3. Actions에서 `workflow_dispatch`로 한 번 돌려 전체 동기화

그다음 `/admin`에서 볼 사람들의 이메일을 멤버로 등록한다. **등록되지 않은 이메일은
로그인해도 아무것도 못 본다.**

---

## 에이전트 붙이기

`/settings/tokens`에서 발급하면 붙여넣을 명령이 토큰이 박힌 채로 같이 나온다.
아무 디렉터리에서 한 번 실행하면 끝 — **레포를 받을 필요도, 환경변수를 심을 필요도 없다.**

```
claude mcp add --transport http --scope user cushion https://<cushion>/api/mcp --header "Authorization: Bearer cshn_pat_..."
```

여기에 토큰을 직접 넣는 이유는 이 명령이 쓰는 `~/.claude.json`이 커밋되지 않기 때문이다.
평문으로 남으므로 새면 재발급한다 — 그 순간 옛 토큰은 죽는다.

레포에 커밋해 팀 전체에 배포하고 싶으면 `.mcp.json`을 쓴다. 그건 커밋되는 파일이라
토큰을 박지 않고 환경변수(`CUSHION_TOKEN`) 확장을 쓴다. `/admin`의 레포 등록 화면이 그
스니펫을 낸다.

| 툴 | 하는 일 |
|---|---|
| `spec_outline` | 문서 목록 + `##` 헤딩만. **먼저 이걸 부른다** |
| `spec_get` | 문서 또는 섹션 하나. `if_none_match`로 안 바뀌면 본문 대신 `unchanged` |
| `spec_search` | 매칭된 섹션 상위 N개 |
| `spec_changes_since` | 커서 이후 변경 요약. 커서는 서버가 기억한다 |

구독은 폴링도 상시 연결도 쓰지 않는다. 밀렸을 때만 아무 툴 응답 끝에 한 줄이 붙는다:
`[stale] <repo>: <path> changed — call spec_changes_since`. 안 밀렸으면 그 줄이 아예 없으므로
**추가 비용 0**이다.

**툴이 있다고 에이전트가 쓰지 않는다.** 프로젝트 `AGENTS.md`에 3줄을 넣어야 로컬 파일을
통째로 읽는 대신 이걸 쓴다. 그 3줄도 `/admin`이 출력해 준다.

---

## 스택

Next.js **16** App Router · Tailwind v4 + shadcn/ui · Supabase(Postgres) · NextAuth v5 Google · Vercel.

**LLM API 키가 없다.** 변경 요약은 경로 + 바뀐 `##` 헤딩 + 증감 줄 수로 구조적으로 만든다.
미러 갱신 경로에 LLM을 심으면 LLM이 죽을 때 동기화가 같이 죽는다.

---

## 문서

| 문서 | 담는 것 |
|---|---|
| [`SPEC.md`](SPEC.md) | 무엇을·왜. 데이터 모델, MCP 툴 명세, 검증 항목 |
| [`AGENTS.md`](AGENTS.md) | 코드를 읽어선 알기 어려운 규칙과 함정 |
| [`PLAN.md`](PLAN.md) | 현재 상태, 다음 작업, **결정 로그** |
| [`supabase/migrations/`](supabase/migrations) | DB 스키마의 원본 |

기능을 제안하기 전에 `PLAN.md`의 결정 로그를 먼저 읽는다. 문서 CRUD·LLM 요약·임베딩 검색·
폴링 구독은 이미 기각됐고, 각 항목에 근거와 재검토 조건이 같이 적혀 있다.
