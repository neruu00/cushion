# Cushion

> 쿠션이 완충해 토큰을 줄인다.

**에이전트를 1차 독자로 삼은 문서 도서관.** 스펙·ADR·런북·회의록·용어집 —
프로젝트 문서를 한곳에 두고, 팀에는 변경 알림을 보내고,
에이전트에는 MCP로 **필요한 조각만** 읽고 쓰게 한다.

목적은 하나 — 에이전트가 같은 문서를 반복해서 컨텍스트에 싣느라 태우는 토큰을 줄이는 것.

**이 레포 자신의 문서로 잰 값**: 전량 로드 대비 **20% 미만 — 5배 이상 절감**
(작업 3건 기준, 목차 1회 + 필요한 섹션 1개씩). 목차는 세션당 한 번이라 작업이 늘수록 더 벌어진다.

숫자를 여기 박아 두지 않는다 — 측정 대상이 이 레포의 문서라 문서가 자라면 같이 움직인다.
`pnpm acceptance`가 그때그때 다시 잰다. 방법은 Cushion의 `PLAN.md` T-601.

---

## 어떻게 동작하나

```
                        Cushion
                    ─────────────
사람  ─웹 편집→     documents  (원본)          ─MCP→  에이전트
에이전트 ─doc_put→  document_versions (이력)   ─→    웹 화면
                    sync_events                ─→    Mattermost
```

**문서의 원본이 여기 있다.** 예전엔 git 레포의 `.md`를 비추는 미러였지만, 남의 레포 문서를
고치려면 클론이 필요했다 — 읽으려고 클론을 피하는 도구가 쓰려면 클론을 요구하는 셈이라
방향을 뒤집었다(PLAN `D-011`).

그래서 git이 공짜로 주던 것을 대신할 장치가 있다:

- **이력** — 덮어쓰기 전에 이전 본문을 남긴다. 지워도 남는다
- **동시 편집** — 읽을 때 받은 `sha`를 쓸 때 되돌려 준다. 어긋나면 **거부**한다. 병합하지 않는다
- **내보내기** — `/api/export`. git이 없으니 이게 유일한 백업이다

## 시작하기

필요한 것: Node 24+, pnpm, Supabase 프로젝트, Google OAuth 클라이언트.

```bash
pnpm install
cp .env.example .env.local     # 값을 채운다
```

`SUPABASE_SERVICE_ROLE_KEY`에는 **`service_role` 키**를 넣는다. anon 키를 넣으면
RLS 정책이 0개라 모든 읽기가 빈 결과, 모든 쓰기가 거부되는데 **에러 없이 조용하다.**
"화면이 비었다 / 아무 일도 안 일어난다"면 이 키부터 본다.

`supabase/migrations/0001_schema.sql`을 Supabase SQL Editor에서 실행한다(멱등하다). 그다음:

```bash
pnpm dev
```

`ADMIN_EMAILS`에 든 이메일로 로그인하면 `/admin`이 열린다.

| 목적 | 명령 |
|---|---|
| 개발 서버 | `pnpm dev` |
| 전체 검증 | `pnpm verify` — 타입 + 린트 + 테스트 + 빌드 |
| 인수 검증 | `pnpm acceptance` — SPEC §11을 실 DB로 관통 (dev 서버 필요) |

---

## 레포 등록하기

`/admin`에서 레포를 만들고 볼 사람들의 이메일을 멤버로 등록한다.
**등록되지 않은 이메일은 로그인해도 아무것도 못 본다.**

문서는 `/[repo]` 화면의 "새 문서"로 만들거나 에이전트가 `doc_put`으로 만든다.
경로는 `.md`로 끝나야 한다 — 목차·섹션 조회가 전부 마크다운을 전제한다.

**읽기와 쓰기의 문턱이 같다.** 볼 수 있는 사람은 고칠 수 있다. 역할을 나누지 않는다.

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
| `doc_outline` | 문서 목록 + `##` 헤딩만. **먼저 이걸 부른다** |
| `doc_get` | 문서 또는 섹션 하나. `if_none_match`로 안 바뀌면 본문 대신 `unchanged` |
| `doc_search` | 매칭된 섹션 상위 N개 |
| `doc_changes_since` | 커서 이후 변경 요약. 커서는 서버가 기억한다 |
| `doc_put` | 생성·수정. 기존 문서는 `base_sha` 필수 — 어긋나면 거부하고 현재 sha를 준다 |
| `doc_delete` | 삭제. 이전 본문은 이력에 남는다 |

구독은 폴링도 상시 연결도 쓰지 않는다. 밀렸을 때만 아무 툴 응답 끝에 한 줄이 붙는다:
`[stale] <repo>: <path> changed — call doc_changes_since`. 안 밀렸으면 그 줄이 아예 없으므로
**추가 비용 0**이다.

**툴이 있다고 에이전트가 쓰지 않는다.** 프로젝트 `AGENTS.md`에 몇 줄을 넣어야 이걸 쓴다.
그 문구도 `/admin`의 레포 등록 화면이 출력해 준다.

---

## 스택

Next.js **16** App Router · Tailwind v4 + shadcn/ui · Supabase(Postgres) · NextAuth v5 Google · Vercel.

**LLM API 키가 없다.** 변경 요약은 경로 + 바뀐 `##` 섹션 + 증감 줄 수로 구조적으로 만든다.
쓰기 경로에 LLM을 심으면 LLM이 죽을 때 편집이 같이 죽는다.

---

## 문서

**`SPEC.md`와 `PLAN.md`는 이 레포에 없다.** Cushion 자신이 갖고 있다 — 이 도구가
실제로 쓸 만한지 스스로 겪어 보려고 그렇게 뒀다(dogfooding, D-011).

| 문서 | 어디에 | 담는 것 |
|---|---|---|
| `SPEC.md` | [Cushion](https://cushion-chi.vercel.app/repositories/cushion/SPEC.md) | 무엇을·왜. 데이터 모델, MCP 툴 명세, 검증 항목 |
| `PLAN.md` | [Cushion](https://cushion-chi.vercel.app/repositories/cushion/PLAN.md) | 현재 상태, 다음 작업, **결정 로그** |
| [`AGENTS.md`](AGENTS.md) | 레포 | 코드를 읽어선 알기 어려운 규칙과 함정 |
| [`supabase/migrations/`](supabase/migrations) | 레포 | DB 스키마의 원본 |

**둘을 보려면 접근 권한이 필요하다.** 이게 이 설계의 비용이다 — 클론만으로는 스펙을 못 읽는다.

기능을 제안하기 전에 Cushion의 `PLAN.md` 결정 로그를 먼저 읽는다. LLM 요약·임베딩 검색·폴링 구독·
자동 병합은 이미 기각됐고, 각 항목에 근거와 재검토 조건이 같이 적혀 있다.
**뒤집힌 결정(D-001 → D-011)도 지우지 않고 남겨 뒀다** — 무엇을 근거로 정했고 그 근거의
어디가 틀렸는지가 남아야 같은 자리에서 같은 실수를 반복하지 않는다.
