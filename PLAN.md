# PLAN

> 현재 상태 · 다음 작업 · 결정 로그
> 최종 갱신: 2026-08-13

---

## 📌 결정 로그

향후 작업자(사람/에이전트)가 뒤집지 않도록 결정과 근거를 남긴다.
**여기 있는 항목을 다시 제안하려면 근거부터 반박해야 한다.**

### ~~D-001. 스펙 원본은 git 레포다. Cushion은 읽기 전용 미러다~~ — **D-011로 뒤집힘 (2026-08-13)**

> 지우지 않고 남긴다. **무엇을 근거로 결정했고 그 근거의 어디가 틀렸는지**가 남아야
> 다음에 같은 자리에서 같은 실수를 반복하지 않는다.
>
> 아래 근거 중 "에이전트 쓰기 = 파일 편집 + PR, 이미 되는 것"이 **자기 레포에서만 참**이었다.
> 남의 레포 문서를 고쳐야 하는 경우 — FE가 BE의 API 계약을 손대는, 이 도구를 쓰는 바로 그
> 상황 — 에서는 클론이 필요했다. 읽으려고 클론을 피하는 도구가 쓰려면 클론을 요구한 셈이다.
> 나머지 근거(git이 버전관리를 공짜로 한다, 서비스가 죽어도 로컬 파일이 있다)는 **여전히 맞고,
> 그래서 D-011이 그만큼을 실제로 잃는다.**

**당시 결정**: 문서 CRUD API·편집 UI·버전 이력 테이블·낙관적 잠금·충돌 해결을 만들지 않는다.

**근거**:

- 버전관리·diff·이력·리뷰(PR)·병합을 git이 이미 공짜로 한다. DB 기반 문서 저장소를 얹으면 git을 더 못하게 다시 만드는 것이다
- 스펙 작성자가 전원 개발자다. 웹 에디터의 수요가 없다
- 에이전트 쓰기 = 파일 편집 + PR. 이미 되는 것이라 만들 게 없다
- 서비스가 죽어도 에이전트는 로컬 파일을 읽으면 된다 — 가용성이 공짜로 해결된다

**재검토 조건**: 비개발자가 스펙을 **직접 작성**해야 할 때. 그때도 원본은 git으로 두고 "제안 → PR 자동 생성" 경로를 만든다.

### D-002. 알림·델타 요약에 LLM을 쓰지 않는다 (2026-08-13)

**결정**: `sync_events.summary`는 **변경 경로 + 바뀐 `##` 헤딩 + 증감 줄 수 + 커밋 메시지**로 구조적으로 생성한다.

**근거**:

- 요약 모델이 보는 건 diff 텍스트뿐이다. **"어느 코드가 영향받는지"를 알 수 없다** — 판단이 추측이 되고, 틀린 추측 한 번이면 알림을 안 읽게 된다
- 에이전트 쪽은 더 분명하다. `spec_changes_since`가 산문 요약을 줘도 실제 내용은 `spec_get`으로 다시 가져와야 한다. **경로+헤딩 목록이 요약보다 싸고 더 유용하다** — outline-first와 같은 논리
- 스펙 diff는 산문이라 짧으면 원문이 그 자체로 읽힌다
- 미러 갱신 경로에 LLM을 심으면 LLM이 죽을 때 동기화가 같이 죽는다. v1에 외부 AI 프로바이더 의존성이 아예 없다

**재검토 조건**: 구조적 요약으로 "뭐가 바뀐 건지 모르겠다"는 말이 실제로 나올 때. 스키마 변경 없이 `summary` 생성 함수만 교체하고, **LLM 실패 시 구조적 요약으로 떨어지게(fail-open)** 붙인다.

### D-003. 유저 테이블을 만들지 않는다 (2026-08-13)

**결정**: `repository_members(repository_id, email)` 한 테이블이 허용 목록과 레포 권한을 동시에 담는다.

**근거**: 허용 목록이 이메일 기준이고 대상자가 아직 가입 전일 수 있다. 정체성은 NextAuth가 관리하므로 별도 유저 레코드가 할 일이 없다. 행이 0개인 이메일 = 아무것도 못 봄, 이 한 줄로 요구사항이 충족된다.

### D-004. 검색은 substring 스코어링. 임베딩·벡터 DB 금지 (2026-08-13)

**근거**: 스펙 문서 수십 개 규모에서 임베딩 인프라가 정당화되지 않는다.
**재검토 조건**: substring이 부족해질 때 → `to_tsvector` + GIN → 그래도 안 되면 임베딩.

### D-005. 구독은 커서 방식. 폴링·상시 연결 없음 (2026-08-13)

**결정**: 토큰×레포별 `last_event_id`를 서버가 보관하고, **아무 MCP 툴 응답 끝에** 밀렸을 때만 `[stale] ...` 한 줄을 얹는다.

**근거**: "항상 최신"을 폴링으로 풀면 그 자체가 토큰을 태운다 — 도구의 목적과 정반대다. 안 밀렸으면 그 줄이 아예 없으므로 **추가 비용 0**, 추가 라운드트립 0, 열린 연결 0.

**MCP 표준 `resources/subscribe` 푸시를 쓰지 않는 이유**: 클라이언트 지원이 갈린다.
**재검토 조건**: 주요 클라이언트 지원이 확인될 때.

### D-006. 동기화는 레포가 민다. Cushion이 GitHub을 당기지 않는다 (2026-08-13)

**근거**: Cushion이 GitHub API를 당기면 GitHub App/PAT·권한 설정·레이트리밋·토큰 회전이 전부 딸려온다. 반대로 하면 전부 사라진다 — CI는 이미 파일을 체크아웃해 놨다. **Cushion은 GitHub 자격증명을 하나도 갖지 않는다.**

### D-011. 스펙의 원본을 Cushion에 둔다. git 동기화를 걷어낸다 (2026-08-13)

**결정**: `documents`가 캐시가 아니라 원본이다. 웹 편집 화면과 MCP 쓰기 툴(`spec_put`/`spec_delete`)로
고친다. `/api/sync`·`cushion-sync.yml`·sync 토큰을 전부 제거한다.

**근거**: D-001의 "쓰기는 이미 git이 한다"가 교차 레포에서 성립하지 않았다. 읽기를 위해
클론을 피하게 해 놓고 쓰기에는 클론을 요구하면, 정작 이 도구가 필요한 상황에서 쓸 수 없다.

**대가를 명시한다** — 이건 순이득이 아니다:

- PR 리뷰·blame·브랜치·머지가 사라진다. 대신 `document_versions`(append-only)와
  `base_sha` 낙관적 잠금으로 최소한만 되찾는다. **병합은 하지 않는다** — 근거가 없다
- **서비스가 죽으면 스펙을 못 본다.** 실제로 배포·토큰·워크플로가 다 깨져 있던 동안
  로컬 파일로 계속 일했는데, 앞으로는 그 시간에 볼 수단이 없다.
  그래서 `/api/export`를 만들었다 — 이게 유일한 탈출구다
- **PAT가 읽기 전용이 아니게 됐다.** 유출되면 스펙을 훼손할 수 있다. 복구 근거는 이력뿐이다

**두 원본이 공존하면 안 된다.** 동기화를 남기면 다음 push가 편집을 덮어쓰고, 레포에 `.md`를
남기면 에이전트가 낡은 사본을 읽는다 — 지금보다 나쁜 드리프트다. 그래서 제거는 선택이 아니었다.

**재검토 조건**: 스펙을 코드와 같은 PR에서 리뷰해야 한다는 요구가 실제로 나올 때.
그때는 D-001의 근거가 다시 살아난다.

### D-010. MCP OAuth 대신 토큰이 박힌 CLI 명령을 준다 (2026-08-13)

**결정**: 연결은 `/settings/tokens`가 출력하는 `claude mcp add … --header "Authorization: Bearer …"`
한 줄이다. MCP OAuth(authorization server metadata · dynamic client registration · PKCE · 리프레시)를
구현하지 않는다.

**근거**:

- 없애려던 건 "레포 클론 + 환경변수 설정" 두 단계다. 명령 한 줄이 그걸 **전부** 없앤다.
  OAuth가 추가로 없애는 건 "토큰 문자열을 사람이 한 번 다루는 것"뿐이다
- 서버 코드가 0줄 늘어난다. `/api/mcp`는 이미 Bearer를 받는다
- OAuth는 엔드포인트 4개와 상태 관리를 새로 들이고, D-009(SDK 없이 JSON-RPC 직접, 100줄)의
  근거를 통째로 뒤집는다
- 토큰이 `~/.claude.json`에 평문으로 남는 건 환경변수를 dotfile에 두는 것과 같은 등급이다.
  회수 경로도 이미 있다 — 재발급하면 `revoked_at`으로 구 토큰이 즉시 죽는다

**재검토 조건**: 팀이 커져 토큰 배포·회수가 짐이 될 때. 사람마다 토큰을 만들어 나눠 주는
일이 반복되기 시작하면 그때가 OAuth가 값을 하는 시점이다.

### D-009. MCP SDK를 넣지 않는다. JSON-RPC를 직접 쓴다 (2026-08-13)

**결정**: `@modelcontextprotocol/sdk` 없이 `app/api/mcp/route.ts`에서 JSON-RPC 2.0을 직접 처리한다.

**근거**: 이 서버는 세션도 SSE도 없고 읽기 툴 4개뿐이다. SDK가 값을 하는 부분(세션 관리,
스트림 전송, 서버 발신 알림)을 하나도 쓰지 않는다. 실제로 필요한 건 POST 하나에
`initialize` / `tools/list` / `tools/call` / `ping`을 태우는 것뿐이고 그게 100줄이다.
Next 라우트 핸들러에 SDK 트랜스포트를 물리려면 어댑터가 하나 더 붙는다.

**재검토 조건**: 서버가 먼저 말을 걸어야 할 때(`resources/subscribe` 푸시 등, D-005 참조).
그때는 SSE가 필요하고 SDK가 값을 한다.

### D-008. 토큰 파싱(순수)과 토큰 조회(DB)를 다른 파일에 둔다 (2026-08-13)

**결정**: `lib/token.ts`는 `node:crypto`만 쓰는 순수 함수(발급·sha256·접두사 파싱), DB를 타는
`emailFromAccessToken` / `repoFromSyncToken`은 `lib/authz.ts`에 둔다.

**근거**: 토큰 종류 분리(`cshn_pat_` vs `cshn_sync_`)가 보안의 핵심인데, 같은 파일에 Supabase
클라이언트가 있으면 `node --test`로 그 한 줄을 검증할 수 없다(환경변수 + `@/` 별칭 때문에
plain Node가 import를 못 한다). 러너를 추가하는 대신 파일을 나눴다 — 의존성 0개.

**재검토 조건**: 테스트 러너를 어차피 들이게 될 때. 그때도 나눠 둬서 손해는 없다.

### D-007. Next.js 16을 쓴다 (블로그 프로젝트는 15) (2026-08-13)

**근거**: 신규 프로젝트라 최신을 유지한다. 대신 `middleware.ts` → `proxy.ts`, 동기 요청 API 제거, `revalidateTag` 2인자 등 실제 차이가 있으므로 **코드 작성 전 `node_modules/next/dist/docs/` 확인이 필수**다. `AGENTS.md` §1 참조.

---

## ✅ 완료 (2026-08-13)

| 항목                 | 산출물                                                                           |
| -------------------- | -------------------------------------------------------------------------------- |
| 스펙 확정            | `SPEC.md`                                                                        |
| 규칙 문서화          | `AGENTS.md` (`CLAUDE.md`가 import)                                               |
| Next 16 스캐폴딩     | App Router / TS / Tailwind v4, `pnpm verify` 통과                                |
| shadcn/ui 초기화     | base·nova (Base UI + Lucide + Geist), `components.json`                          |
| 의존성               | `@supabase/supabase-js`, `next-auth@5.0.0-beta.32`, `zod@4`                      |
| 스크립트             | `typecheck`, `verify` 추가                                                       |
| 초기 스키마 SQL      | `supabase/migrations/0001_init.sql`                                              |
| 환경변수             | `.env.local` 전 항목 채움, `.env.example` 커밋                                   |
| DB 마이그레이션 실행 | 6개 테이블 실재 확인 (T-001)                                                     |
| 기반 레이어          | `lib/supabase.ts` · `auth.ts` · `authz.ts` · `token.ts` · `proxy.ts` (T-101~105) |
| 관리 화면            | `/admin` · `/settings/tokens` · 설치 스니펫 출력 (T-201~203)                     |
| ~~동기화 수신~~      | D-011로 제거. 원본이 Cushion에 있으므로 레포가 밀 것이 없다                      |
| MCP 서버             | `POST /api/mcp` · 툴 4종 · 커서 구독 (T-401~404)                                 |
| 읽기 화면            | `/` · `/[repo]` · `/[repo]/[...path]` · 헤더 (T-501·502)                         |

---

## 🚧 T-0. 착수 전 차단 항목

- [x] **T-001** `supabase/migrations/0001_init.sql` 실행 완료.
      6개 테이블(`repositories` / `repository_members` / `documents` / `sync_events` /
      `access_tokens` / `token_cursors`) 실재 확인함.

- [x] **T-002** `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`가 한동안 anon 키였다 → `service_role`로 교체 완료.
      **증상이 조용하다는 걸 기억해 둘 것**: RLS 정책이 0개라 anon 키로는 읽기가 빈 배열,
      쓰기가 42501로 거부된다. "화면이 비었다 / 아무 일도 안 일어난다"면 이 키부터 본다.

---

## 🔨 T-1. 기반

- [x] **T-101** `lib/supabase.ts` — service_role 단일 클라이언트(`supabase`). 상단에 RLS 경고 주석
- [x] **T-102** `lib/auth.ts` — NextAuth v5 Google + `app/api/auth/[...nextauth]/route.ts`.
      `jwt` 콜백에서 이메일 lowercase, `name`·`picture`는 쿠키에서 제거
- [x] **T-103** `lib/authz.ts` — `getSessionEmail()`, `isAdminEmail()`/`isAdmin()`(**비면 false**),
      `getMemberRepoIds()`, `getAccessibleRepos()`, `getAccessibleRepo()`,
      `identityFromAccessToken()`(T-4에서 개명 — 커서가 토큰 id에 매달린다), `repoFromSyncToken()`
      _`assertRepoAccess()` 대신 `getAccessibleRepo(email, slug) → Repo | null`._
      _호출부가 null을 404로 처리한다 — 던지면 403/404 구분이 호출부에서 사라진다_
- [x] **T-104** `lib/token.ts` — 발급(`cshn_pat_`/`cshn_sync_`) · `sha256` · `hashFromAuthHeader()`.
      평문은 `generateToken` 반환값에만 존재. DB 조회·`last_used_at`은 `authz.ts` (D-008).
      `lib/token.test.ts`가 종류 분리를 검증한다
- [x] **T-105** `proxy.ts` — `/admin`, `/settings` 세션 게이트. **UX용이고 권한의 실체가 아니다**

## 🖥 T-2. 관리 화면

- [x] **T-201** `/admin` — 레포 등록, sync 토큰 재발급, 멤버 등록/삭제.
      `actions/repository.ts`가 액션 첫 줄에서 `isAdmin()`을 본다. admin이 아니면 페이지는 404
- [x] **T-202** 등록 직후 `cushion-sync.yml` · `.mcp.json` · `AGENTS.md` 3줄을 복사 버튼과 함께 출력.
      템플릿은 `lib/snippets.ts`, base URL은 `NEXTAUTH_URL`에서 가져온다
- [x] **T-203** `/settings/tokens` — 발급 직후 1회 노출, 폐기는 `revoked_at` 기록(삭제 아님).
      폐기 쿼리에 `email` 조건이 남의 토큰을 못 죽이게 하는 유일한 방어선이다

## 🔄 T-3. 동기화

- [x] **T-301** `POST /api/sync` — sync 토큰 검증 → Zod 파싱(`lib/sync.schema.ts`) → `documents`
      upsert/삭제 → `sync_events` 적재 → Mattermost POST.
      알림 실패가 동기화를 죽이지 않는다(try/catch + 5초 타임아웃). webhook URL은 이 경로에서만 읽는다
- [x] **T-302** `lib/summary.ts` — 경로 + 바뀐 `##` 헤딩 + 증감 줄 수 (D-002).
      헤딩은 diff의 hunk 시작 줄을 **바뀐 뒤 본문**에 되짚어 찾는다.
      저장하는 `summary`에는 diff를 넣지 않는다 — `spec_changes_since`가 그걸 매번 되팔게 된다
- [x] **T-304** `full=true`면 페이로드에 없는 문서를 미러에서 제거.
      `changed`가 비면 지우지 않는다 — 워크플로 오작동으로 미러를 통째로 날리는 게 훨씬 나쁘다.
      **실측 완료**: 임시 레포로 push → 삭제 → full → 빈 full 4케이스 왕복 확인
- [ ] **T-303** `cushion-sync.yml` **실측 검증** (템플릿은 T-202에서 `lib/snippets.ts`에 썼다).
      배포 URL이 있어야 하고 GitHub Actions에서만 돌릴 수 있다. 확인할 것:
      `fetch-depth: 0`, `changed`+`deleted` 둘 다, `before` all-zeros 폴백, diff 40KB 상한.
      _로컬에 `jq`가 없어 워크플로 스크립트는 이 기계에서 돌려보지 못했다_

## 🔌 T-4. MCP

- [x] **T-401** `POST /api/mcp` — Streamable HTTP. **MCP SDK 없이 JSON-RPC 직접**(D-009).
      GET·DELETE는 405(SSE·세션 없음). 권한은 요청마다 `buildContext`가 다시 조회한다
- [x] **T-402** `spec_outline` / `spec_get`(`heading`, `if_none_match`) / `spec_search` / `spec_changes_since`.
      섹션 분할·검색은 `lib/spec.ts`(순수, 테스트 있음), 툴 배선은 `lib/mcp.ts`
- [x] **T-403** `[stale]` 한 줄 (D-005). **처음 붙은 토큰은 커서를 최신으로 깔고 시작한다** —
      안 그러면 첫 호출부터 [stale]이 붙는데 방금 목차를 읽은 에이전트에겐 거짓말이다
- [x] **T-404** `instructions` 140자 (≈70토큰). `initialize` 응답에 실린다

## 🎨 T-5. 읽기 화면

- [x] **T-501** `/` 레포 목록 · `/[repo]` 문서 목록 + 변경 타임라인.
      타임라인은 `sync_events.summary`를 그대로 쓴다 — 알림·MCP 델타와 같은 문자열이다.
      루트 레이아웃에 헤더(로그인·토큰·관리) 추가. 로그인/아웃은 링크가 아니라 폼 액션이다
      (`/api/auth/*`는 페이지가 아니고, 로그아웃은 CSRF 보호되는 POST여야 한다)
- [x] **T-502** `/[repo]/[...path]` — 서버 컴포넌트 `react-markdown` + `remark-gfm`.
      GitHub 링크는 `blob/HEAD/…` — 브랜치를 저장하지 않으므로 기본 브랜치를 따라간다.
      **`rehype-highlight`는 넣지 않았다** — 스펙은 대부분 산문이라 highlight.js + 테마 CSS가
      값어치보다 먼저 온다. SPEC §9도 같이 고쳤다

## 🧪 T-6. 검증

`SPEC.md` §11이 검증 항목의 원본이다. 특히:

`pnpm acceptance`가 §11.2·11.3·11.4·11.5와 절감 실측을 한 번에 돈다
(`scripts/acceptance.mjs`. dev 서버 + 실 DB 필요, 임시 데이터는 스스로 지운다).
손검증을 다시 손으로 하지 않으려고 스크립트로 굳혔다.

- [x] **T-601** **토큰 절감 실측** — 이 레포의 실제 `SPEC.md`·`AGENTS.md`·`PLAN.md`로 측정.

      대조군: 3개 전량 로드. 실험군: `spec_outline` 1회 + 작업당 섹션 1개 × 3건.
      작업 3건은 "토큰 발급 규칙"(SPEC §6), "MCP 툴 인자"(SPEC §7), "파일명 규칙"(AGENTS 코드 규칙).

      **결과: 대조군의 20% 미만, 5배 이상.** (2026-08-13 두 차례 측정에서 18.2% / 17.3%)

      **수치를 문서에 박지 않는다** — 측정 대상이 이 레포의 문서라 문서가 자라면 값이 같이 움직인다.
      실제로 이 항목을 적는 것만으로 대조군이 커져 비율이 바뀌었다. `pnpm acceptance`가 그때그때 다시 잰다.
      문자 수 기준이다 — 토크나이저마다 절대값은 달라지지만 두 값이 같은 종류의 글이라 비율은 유지된다.
      outline은 세션당 1회이므로 작업이 늘수록 비율은 더 벌어진다.

- [x] **T-602** 권한 매트릭스 — 스크립트 12건 + 서버 액션 정적 검사 6건 전부 통과.
      _멤버 제거 → 같은 토큰으로 즉시 차단_, _폐기 토큰 401_, _sync↔access 토큰 교차 거부_,
      _레포 A 토큰으로 B 갱신 불가_, _미등록 이메일은 목록에도 URL 직입력에도 안 잡힘_,
      _이메일 대소문자 정규화_ 포함.
      **`ADMIN_EMAILS` fail-closed는 서버 재기동이 필요해 손으로 확인했다**:
      빈 값이면 admin 세션도 `/admin` 404, 정상 값이면 admin만 200.
      서버 액션은 런타임으로 찌르려면 빌드 해시가 필요해서 소스로 검사한다 —
      `actions/*.ts`의 모든 export가 `isAdmin()`/`getSessionEmail()`로 시작하는지 본다
      (`session.ts`는 예외, 로그인은 세션이 없어야 부른다).

- [x] **T-603** 삭제 동기화 — 삭제 push · `full` 동기화 prune · 빈 동기화 무시 3케이스 통과.

- [ ] **T-604** 알림 품질 (SPEC §11.6) — 받은 메시지 3건이 링크를 열지 않고 "나에게 영향 있나"를
      판단하게 하는지. **사람이 읽어야 한다.** Mattermost webhook을 실제로 물린 뒤.

> **검증 중에 잡은 버그**: CRLF로 체크아웃된 문서는 `## 제목\r`이 되는데 JS 정규식의 `.`는
> `\r`를 매치하지 않아 **헤딩 인식이 통째로 실패했다** — 목차도 섹션 조회도 빈 결과.
> 수신부(`sync.schema.ts`)에서 LF로 접고, 순수 함수들도 `\r?\n`으로 쪼개도록 고쳤다. 테스트 2건 추가.
> Windows에서 작성된 레포면 어디서나 터진다 — 장난감 문서로만 검증했으면 못 잡았다.

## 🚀 T-7. 배포와 연결

- [x] **T-702** 발급 화면이 `claude mcp add` 명령을 토큰이 박힌 채로 출력.
      `lib/snippets.ts`의 `connectCommand()`, `actions/token.ts`가 `SecretPayload.files`에 실어 보낸다.
      **서버 코드는 안 건드렸다** — `/api/mcp`는 이미 `Authorization: Bearer`를 받는다.
      한 줄로 내는 이유: 백슬래시 줄바꿈이 PowerShell·cmd에서 깨진다.
      `.mcp.json`(환경변수 확장) 경로는 팀 배포용으로 남겨 뒀다.

- [x] **T-701** Vercel 배포 완료 — **https://cushion-chi.vercel.app**
      `CUSHION_URL=https://cushion-chi.vercel.app pnpm acceptance` 전부 통과.
      배포본에서 확인한 것: `/api/mcp` GET 405 · 무토큰 POST 401, `/api/sync` 401,
      `/admin` → signin 302, Google 콜백 URL이 배포 도메인.

      **여기서 잡은 것 둘**:
      ① 인수 스크립트가 HTTP 전용이었다. Auth.js는 HTTPS면 쿠키 이름에 `__Secure-`를
      붙이고 그 이름을 JWT salt로도 쓴다 — 스킴에 따라 고르도록 고쳤다.
      ② `NEXTAUTH_URL`을 빠뜨려도 NextAuth는 요청 호스트로 잘 돌아서 **스니펫만 조용히
      localhost가 된다.** `baseUrl()`이 `VERCEL_PROJECT_PRODUCTION_URL`로 떨어지게 했다.

- [x] **T-704** 첫 실사용에서 드러난 두 가지를 고쳤다.

      ① **워크플로 기본 경로가 문서를 조용히 빠뜨린다.** `.specs/**`·`AGENTS.md`·`CLAUDE.md`만
      보는데 이 레포의 스펙은 루트의 `SPEC.md`·`PLAN.md`다 — 등록해도 목차에 안 뜬다.
      **누락은 소음보다 나쁘다**(에이전트가 로컬 사본을 읽는다 = 이 도구가 없애려는 드리프트).
      기본값을 `**.md`로 바꾸고, 좁히는 자리를 주석으로 남겼다.

      ② **`.mcp.json`과 CLI 명령을 둘 다 따르면 조용히 깨진다.** 이름이 같은 `cushion`이라
      프로젝트 스코프가 user 스코프를 덮고, `CUSHION_TOKEN`이 없으니 그 디렉터리에서만 401.
      `/admin` 스니펫 라벨에 "팀 배포용, 개인은 명령 한 줄로 충분"을 박았다.

- [ ] **T-703** 실 Claude Code로 접속 확인 (SPEC §11.5의 마지막 항목).
      **cushion 레포와 무관한 빈 디렉터리**에서 명령 실행 → `claude mcp list` → "스펙 목차 보여줘".
      토큰 폐기 후 재호출도 해 보고, 그때 클라이언트가 뭘 보여주는지 관찰한다 —
      우리 401은 `WWW-Authenticate: Bearer`를 달고 있어 OAuth 탐색을 시도할 수 있다.
      **혼란스러우면 그때 고친다. 지금 추측으로 손대지 않는다.**

> T-701이 끝나면 **T-303(워크플로 실측)의 차단이 풀린다.** GitHub Actions가 도달할 실 URL이 생긴다.

---

## ❓ 미해결 질문

1. **Cushion 자체의 스펙도 Cushion으로 관리하나?** (dogfooding) — T-3까지 끝나면 이 레포를 첫 등록 대상으로 삼는 게 자연스럽다
2. ~~**배포 도메인**~~ — `https://cushion-chi.vercel.app` (T-701). 문서에는 도메인을 박지 않는다.
   스니펫 URL은 `baseUrl()`이 런타임에 만들고, 다른 사람이 자기 인스턴스를 띄울 수 있어야 한다
3. **레포가 여러 개가 아니면 Cushion이 필요한가?** — `SPEC.md` §2 전제 참조. ①교차 조회 ②GitHub 접근권 없는 독자, 둘 다 아니면 로컬 MCP + GitHub Action으로 충분하다
