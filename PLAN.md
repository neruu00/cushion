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
| 초기 스키마 SQL | `supabase/migrations/0001_init.sql` — **실행 대기** |
| 환경변수 | `.env.local` 전 항목 채움, `.env.example` 커밋 |

---

## 🚧 T-0. 착수 전 차단 항목

- [ ] **T-001** `supabase/migrations/0001_init.sql`을 Supabase SQL Editor에서 실행.
      **사람이 실행한다** — 에이전트는 SQL만 작성한다.
      실행 후 `repositories` / `repository_members` / `documents` / `sync_events` / `access_tokens` / `token_cursors` 6개 테이블 존재 확인.

---

## 🔨 T-1. 기반

- [ ] **T-101** `lib/supabase.ts` — service_role 단일 클라이언트. **파일 상단에 "RLS 없음, 호출부가 권한 검사" 주석 필수**
- [ ] **T-102** `lib/auth.ts` — NextAuth v5 Google. 세션에 이메일(lowercase)만 담는다
- [ ] **T-103** `lib/authz.ts` — `isAdmin()`(ADMIN_EMAILS, **비면 false**), `getMemberRepoIds(email)`, `assertRepoAccess()`
- [ ] **T-104** `lib/token.ts` — 발급(`cshn_pat_`/`cshn_sync_`) · `sha256` 해시 · 검증 · `last_used_at` 갱신. **평문 저장 경로가 존재하지 않게 설계**
- [ ] **T-105** `proxy.ts` — `/admin`, `/settings` 세션 게이트. **이건 UX용이고 권한의 실체가 아니다**(서버 액션을 못 막는다)

## 🖥 T-2. 관리 화면

- [ ] **T-201** `/admin` — 레포 생성(slug·name·github_full_name·webhook), sync 토큰 발급/재생성, 멤버 이메일 등록/삭제
- [ ] **T-202** 레포 생성 직후 **`cushion-sync.yml`과 `.mcp.json`을 복붙 가능한 형태로 화면에 출력**. 별도 설치 가이드를 만들지 않아도 되게
- [ ] **T-203** `/settings/tokens` — access token 발급·재생성 (직후 1회 노출)

## 🔄 T-3. 동기화

- [ ] **T-301** `POST /api/sync` — sync 토큰 검증 → Zod 파싱 → `documents` upsert/삭제 → `sync_events` 적재 → Mattermost POST
- [ ] **T-302** 구조적 요약 생성기 (경로 + 바뀐 `##` 헤딩 + 증감 줄 수). D-002
- [ ] **T-303** `cushion-sync.yml` 템플릿 — `fetch-depth: 0`, `changed`+`deleted` 둘 다, `before` all-zeros면 전체 스냅샷 폴백, 페이로드 상한
- [ ] **T-304** `workflow_dispatch` 전체 동기화(`full=true`)

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
