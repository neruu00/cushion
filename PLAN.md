# PLAN

> 현재 상태 · 다음 작업 · 결정 로그
> 최종 갱신: 2026-08-13

---

## 📌 결정 로그

향후 작업자(사람/에이전트)가 뒤집지 않도록 결정과 근거를 남긴다.
**여기 있는 항목을 다시 제안하려면 근거부터 반박해야 한다.**

### D-001. 스펙 원본은 git 레포다. Cushion은 읽기 전용 미러다 (2026-08-13)

**결정**: 문서 CRUD API·편집 UI·버전 이력 테이블·낙관적 잠금·충돌 해결을 만들지 않는다.

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

| 항목 | 산출물 |
|---|---|
| 스펙 확정 | `SPEC.md` |
| 규칙 문서화 | `AGENTS.md` (`CLAUDE.md`가 import) |
| Next 16 스캐폴딩 | App Router / TS / Tailwind v4, `pnpm verify` 통과 |
| shadcn/ui 초기화 | base·nova (Base UI + Lucide + Geist), `components.json` |
| 의존성 | `@supabase/supabase-js`, `next-auth@5.0.0-beta.32`, `zod@4` |
| 스크립트 | `typecheck`, `verify` 추가 |
| 초기 스키마 SQL | `supabase/migrations/0001_init.sql` |
| 환경변수 | `.env.local` 전 항목 채움, `.env.example` 커밋 |
| DB 마이그레이션 실행 | 6개 테이블 실재 확인 (T-001) |
| 기반 레이어 | `lib/supabase.ts` · `auth.ts` · `authz.ts` · `token.ts` · `proxy.ts` (T-101~105) |
| 관리 화면 | `/admin` · `/settings/tokens` · 설치 스니펫 출력 (T-201~203) |
| 동기화 수신 | `POST /api/sync` · 구조적 요약 · 전체 동기화 (T-301·302·304) |

---

## 🚧 T-0. 착수 전 차단 항목

- [x] **T-001** `supabase/migrations/0001_init.sql` 실행 완료.
      6개 테이블(`repositories` / `repository_members` / `documents` / `sync_events` /
      `access_tokens` / `token_cursors`) 실재 확인함.

- [ ] **T-002** ⛔ **`.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`에 anon 키가 들어 있다** (`role=anon` 확인).
      RLS는 켜져 있고 정책이 0개라 **모든 읽기가 빈 결과, 모든 쓰기가 거부**된다 — 앱은 조용히 아무것도 안 한다.
      Supabase Dashboard > Project Settings > API Keys 의 `service_role`(또는 신형 `sb_secret_…`) 값으로 교체할 것.
      **사람이 한다** — 키는 대화에 출력하지 않는다.
      이게 막혀 있는 동안 DB를 타는 경로(`/admin`, `/settings/tokens`, `/api/sync`)는 실측 검증이 불가능하다.

---

## 🔨 T-1. 기반

- [x] **T-101** `lib/supabase.ts` — service_role 단일 클라이언트(`supabase`). 상단에 RLS 경고 주석
- [x] **T-102** `lib/auth.ts` — NextAuth v5 Google + `app/api/auth/[...nextauth]/route.ts`.
      `jwt` 콜백에서 이메일 lowercase, `name`·`picture`는 쿠키에서 제거
- [x] **T-103** `lib/authz.ts` — `getSessionEmail()`, `isAdminEmail()`/`isAdmin()`(**비면 false**),
      `getMemberRepoIds()`, `getAccessibleRepos()`, `getAccessibleRepo()`,
      `emailFromAccessToken()`, `repoFromSyncToken()`
      *`assertRepoAccess()` 대신 `getAccessibleRepo(email, slug) → Repo | null`.*
      *호출부가 null을 404로 처리한다 — 던지면 403/404 구분이 호출부에서 사라진다*
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
      `changed`가 비면 지우지 않는다 — 워크플로 오작동으로 미러를 통째로 날리는 게 훨씬 나쁘다
- [ ] **T-303** `cushion-sync.yml` **실측 검증** (템플릿은 T-202에서 `lib/snippets.ts`에 썼다).
      배포 URL이 있어야 하고 GitHub Actions에서만 돌릴 수 있다. 확인할 것:
      `fetch-depth: 0`, `changed`+`deleted` 둘 다, `before` all-zeros 폴백, diff 40KB 상한.
      *로컬에 `jq`가 없어 워크플로 스크립트는 이 기계에서 돌려보지 못했다*

## 🔌 T-4. MCP

- [ ] **T-401** `POST /api/mcp` — Streamable HTTP. Bearer 인증 → 이메일 → 요청 시점 권한 조회
- [ ] **T-402** `spec_outline` / `spec_get`(`if_none_match`) / `spec_search` / `spec_changes_since`
- [ ] **T-403** 커서 기반 `[stale]` 한 줄 부착 (D-005)
- [ ] **T-404** 서버 `instructions` — 호출 순서를 박되 **100토큰 이내**

## 🎨 T-5. 읽기 화면

- [ ] **T-501** `/` 레포 목록 · `/[repo]` 문서 목록 + 변경 타임라인
- [ ] **T-502** `/[repo]/[...path]` — 서버 컴포넌트에서 `react-markdown` 렌더, GitHub 원본 링크

## 🧪 T-6. 검증

`SPEC.md` §11이 검증 항목의 원본이다. 특히:

- [ ] **T-601** **토큰 절감 실측** — 대조군(전량 로드) vs 실험군(`spec_outline` + 필요한 섹션). **숫자가 안 나오면 이 도구는 존재 이유가 없다**
- [ ] **T-602** 권한 매트릭스 손검증 8종 (SPEC §11.2) — 특히 *멤버 제거 → 기존 토큰 즉시 차단*, *sync 토큰으로 `/api/mcp` 호출 거부*
- [ ] **T-603** 삭제 동기화 — 스펙 파일 삭제 push 후 미러에서도 사라지는지

---

## ❓ 미해결 질문

1. **Cushion 자체의 스펙도 Cushion으로 관리하나?** (dogfooding) — T-3까지 끝나면 이 레포를 첫 등록 대상으로 삼는 게 자연스럽다
2. **배포 도메인** — 정해지면 `NEXTAUTH_URL`, Google OAuth 리디렉션 URI, `.mcp.json` 템플릿 URL 3곳을 같이 갱신해야 한다
3. **레포가 여러 개가 아니면 Cushion이 필요한가?** — `SPEC.md` §2 전제 참조. ①교차 조회 ②GitHub 접근권 없는 독자, 둘 다 아니면 로컬 MCP + GitHub Action으로 충분하다
