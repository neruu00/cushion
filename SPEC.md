# Cushion — 스펙

> 쿠션이 완충해 토큰을 줄인다.
> AI 스펙주도 개발에서 스펙 문서를 팀·에이전트가 공유하는 읽기 전용 계층.

---

## 1. 왜 만드나

AI 스펙주도 개발에서 실제로 지불하는 비용은 문서 작성이 아니라 **같은 문서를 반복해서 컨텍스트에 싣는 것**이다.

| 새는 곳 | 비용 |
|---|---|
| 세션마다 규칙·스펙 전체 로드 | 팀원 수 × 세션 수만큼 같은 토큰 반복 결제 |
| 한 섹션만 필요한데 파일 전체를 읽음 | 필요분의 5~10배 |
| 마지막 작업 이후 뭐가 바뀐지 몰라 전부 재로드 | 매 세션 풀 리로드 |
| 문서끼리 어긋나 둘 다 읽고 혼란 | 토큰 + 턴 수 동시 증가 |

마지막 항목은 가설이 아니다. 다른 저장소에서 규칙 문서가 수개월간 존재하지 않는 패턴을 지시한 채 방치된 사례가 있다. 문서를 **만드는** 도구는 널렸고, 문서가 **썩는 걸 잡는** 도구는 없다.

**Cushion이 하는 일**: 스펙의 읽기 전용 미러 + 접근 통제 + 섹션 단위 검색 + 변경 델타 + 알림.
에이전트에게는 필요한 조각만, 사람에게는 변경 요약을. **이 둘은 같은 요약을 두 번 쓰는 것이지 두 기능이 아니다.**

---

## 2. 확정된 원칙

| # | 원칙 | 귀결 |
|---|---|---|
| P1 | **스펙 원본은 각 프로젝트 git 레포의 `.md`** | Cushion은 읽기 전용 거울 |
| P2 | 문서 수정은 PR로 한다 | 편집 UI·문서 CRUD API 없음 |
| P3 | 접근 가능 유저는 **이메일로 사전 등록** | 미등록자는 로그인해도 아무것도 못 본다 |
| P4 | admin은 **환경변수**로 지정 | DB에 role 컬럼 없음 |
| P5 | 에이전트는 **AccessToken**으로 붙는다 | 재발급 가능 |
| P6 | 문서·권한 모두 **레포지토리 단위** | |
| P7 | 에이전트가 항상 최신을 구독하되 **토큰 소모 최소** | 폴링·상시연결 금지, 커서 방식 |
| P8 | 스펙 작성자는 전원 개발자 | UI는 얇게 |

### P1이 지우는 것 (만들지 않는다)

| 안 만듦 | 이유 |
|---|---|
| 문서 CRUD | git이 한다. **에이전트 쓰기 = 파일 편집 + PR**, 이미 되는 것 |
| 버전 이력 테이블 | git history가 이력이다 |
| 낙관적 잠금 / 충돌 해결 | git merge가 처리한다 |
| 편집 UI | PR로 고친다 |
| "변경 끌어오기" 기능 | 같은 레포면 `git pull`이 공짜로, 다른 레포는 `spec_get`이 바로 준다 |

그 외 제외: 브라우저 푸시, SMS, Notion 연동, 임베딩·벡터 검색, 개인별 알림 구독, 다크모드 토글.

### ACL이 필요한 이유

GitHub 권한의 중복이 아니다. **비공개 스펙의 사본을 공개 URL 뒤에 두기 때문에** 그 사본을 지키는 것이다. 인증 없는 미러는 그 자체로 유출이다.

> **전제**: Cushion이 값을 하는 건 ① 여러 레포 교차 조회 ② GitHub 접근권 없는 사람에게 공개, 둘 중 하나가 실제일 때다. 둘 다 아니면 로컬 MCP + GitHub Action → Mattermost 조합이 호스팅 0으로 같은 목표를 달성한다.

---

## 3. 스택

Next.js **16** App Router / Tailwind v4 + shadcn/ui(base·nova) / Supabase(Postgres) / NextAuth v5 Google / Vercel.

### Next 16 주의 (블로그의 15와 다른 지점)

**코드를 쓰기 전에 `node_modules/next/dist/docs/`를 읽는다.** 학습 데이터의 Next와 다르다.

| 항목 | Next 16 |
|---|---|
| 미들웨어 | **`middleware.ts` → `proxy.ts`**, 함수명도 `proxy`. edge 런타임 불가(nodejs 고정) |
| `cookies()`·`headers()`·`params`·`searchParams` | **동기 접근 제거** — 전부 `await` |
| `revalidateTag` | 2번째 인자(cacheLife) **필수**. 즉시 반영은 `updateTag`(서버 액션 전용) |
| 린트 | `next lint` 삭제 → `eslint` 직접. `next build`가 린트를 돌리지 않는다 |
| 번들러 | Turbopack 기본. `--turbopack` 플래그 불필요 |
| 빌드 출력 | First Load JS 지표 삭제 (RSC에서 부정확해 제거됨) |
| 타입 헬퍼 | `next typegen` → `PageProps<'/x/[id]'>`, `LayoutProps`, `RouteContext` |

---

## 4. 동기화 — 레포가 민다 (Cushion이 당기지 않는다)

Cushion이 GitHub API를 당기면 GitHub App/PAT·권한 설정·레이트리밋·토큰 회전이 전부 딸려온다. 반대로 하면 전부 사라진다 — CI는 이미 파일을 체크아웃해 놨다.
**Cushion은 GitHub 자격증명을 하나도 갖지 않는다.**

### 각 프로젝트 레포에 넣는 파일

`.github/workflows/cushion-sync.yml`

```
on:
  push:        paths: ['.specs/**', 'AGENTS.md', 'CLAUDE.md']
  workflow_dispatch:   # 전체 동기화용

jobs:
  checkout (fetch-depth: 0)
  → 변경 파일 내용 + 삭제 경로 + git diff + 커밋 메타 수집
  → POST {CUSHION_URL}/api/sync
     Authorization: Bearer ${{ secrets.CUSHION_SYNC_TOKEN }}
```

### 서버 수신 처리

1. sync 토큰 검증 → 레포 식별
2. `documents` upsert / 삭제 경로 제거
3. 변경 경로 + 바뀐 `##` 헤딩으로 **구조적 요약** 생성 (LLM 없음 — §8 참조)
4. `sync_events` 적재
5. Mattermost webhook POST

**외부 API 의존성 0.** 미러 갱신 경로에 LLM을 심으면 LLM이 죽을 때 동기화가 같이 죽는다.

### 반드시 처리할 4가지

1. **삭제 동기화** — 파일이 지워졌는데 미러에 남으면 에이전트가 삭제된 스펙을 읽는다. 이 도구가 없애려는 드리프트를 이 도구가 만든다. `changed`와 **`deleted` 경로를 둘 다** 전송
2. **최초 전체 동기화** — 레포 등록 직후엔 문서가 0건. `workflow_dispatch` + `full=true`로 전량 전송
3. **diff는 Action이 만든다** — Cushion에 git이 없다. 요약과 델타의 원본이 diff이므로 CI에서 떠서 실어 보낸다
4. **`github.event.before`가 all-zeros**(신규 브랜치/force push)면 diff 대신 전체 스냅샷 폴백. `HEAD~1`은 쓰지 않는다 — 한 push에 커밋이 여러 개일 수 있다

페이로드가 크면 잘라내고 "일부 생략" 표기. 알림 하나가 토큰을 태우면 본말전도다.

---

## 5. 데이터 모델

```sql
repositories (
  id uuid pk,
  slug text unique,
  name text,
  github_full_name text,              -- 'org/repo'. 원본 링크 + 후일 드리프트 감지
  mattermost_webhook_url text,        -- 레포당 채널 1개
  sync_token_hash text,
  created_at timestamptz
)

-- 접근 허용 목록 + 레포 권한. 유저 테이블을 따로 두지 않는다.
-- 정체성은 NextAuth가, 허용 여부는 이 테이블의 행 존재가 결정한다.
-- 행이 0개인 이메일 = 로그인해도 아무것도 못 봄 (P3)
repository_members (
  repository_id uuid references repositories(id) on delete cascade,
  email text,                         -- 항상 lowercase 정규화
  primary key (repository_id, email)
)

-- 미러. 원본이 아니므로 version 컬럼도 이력 테이블도 없다
documents (
  id uuid pk,
  repository_id uuid references repositories(id) on delete cascade,
  path text,
  title text,
  content text,
  content_sha text,                   -- 조건부 조회(if_none_match)용
  commit_sha text,
  updated_at timestamptz,
  unique (repository_id, path)
)

-- 델타 피드 + 알림 원본. git history의 스펙 관련 부분만 캐시
sync_events (
  id bigserial pk,
  repository_id uuid references repositories(id) on delete cascade,
  commit_sha text,
  author text,
  message text,
  changed_paths text[],
  deleted_paths text[],
  summary text,                       -- 구조적 요약. 알림과 델타가 공유 (§8)
  created_at timestamptz
)

access_tokens (
  id uuid pk,
  email text,                         -- lowercase
  token_hash text unique,             -- sha256만. 평문 저장 금지
  name text,
  created_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz
)

-- 구독 커서. "에이전트가 최신을 안다"의 전부
token_cursors (
  token_id uuid references access_tokens(id) on delete cascade,
  repository_id uuid references repositories(id) on delete cascade,
  last_event_id bigint,
  updated_at timestamptz,
  primary key (token_id, repository_id)
)
```

**유저 테이블을 만들지 않는 이유**: 허용 목록이 이메일 기준이고 대상자가 아직 가입 전일 수 있다. `repository_members` 한 테이블이 "등록됐나"와 "어느 레포에 접근하나"를 동시에 답한다.

---

## 6. 인증 · 권한

### 주체 3종

| 주체 | 수단 | 확인 지점 |
|---|---|---|
| admin | `ADMIN_EMAILS` 환경변수 (콤마 구분) | 멤버 테이블과 무관하게 통과 |
| 사람 | NextAuth Google 세션 → 이메일 | `repository_members` 조회 |
| 에이전트 | `Authorization: Bearer cshn_pat_...` | `sha256` → `access_tokens` → 이메일 → 위와 동일 조회 |

**핵심**: 토큰에 권한을 굽지 않는다. 토큰은 이메일까지만 해석하고, 레포 권한은 **요청 시점에 조회**한다. 멤버에서 빼면 토큰 재발급 없이 즉시 차단된다.

### 두 종류의 토큰은 섞지 않는다

| | 접두사 | 주체 | 방향 | 스코프 | 보관 |
|---|---|---|---|---|---|
| **sync token** | `cshn_sync_` | 레포(CI) | 쓰기 (미러 갱신) | 그 레포 하나 | GitHub Secret |
| **access token** | `cshn_pat_` | 사람 | 읽기 (스펙 조회) | 그 사람의 모든 레포 | 개인 환경변수 |

섞으면 CI 토큰 유출이 곧 전체 스펙 열람이 된다.

### 반드시 지킬 것

- **`ADMIN_EMAILS`가 비었으면 전원 거부** (fail-closed). 빈 값을 "제한 없음"으로 읽으면 전면 개방이다
- **이메일은 쓸 때·조회할 때 양쪽에서 lowercase.** 대소문자 차이가 곧 ACL 우회 구멍이자 "등록했는데 안 보임" 버그
- Supabase 클라이언트가 `service_role`이면 RLS가 없다 — **모든 서버 액션과 API 라우트가 스스로 권한을 검사한다.** `proxy.ts`(구 미들웨어)는 서버 액션 호출을 막지 못하므로, 그것만 믿고 액션에서 검사를 생략하면 그대로 뚫린다
- 권한 없는 레포 조회는 403이 아니라 **404**. 403은 "그 레포가 존재한다"를 알려준다
- 테이블에 RLS는 켜두되 정책은 두지 않는다(fail-closed). anon 키가 유출돼도 전부 거부된다 — 실제 권한 검사는 애플리케이션에 있다

### 토큰 발급 (양쪽 공통)

- `crypto.randomBytes(32).toString('base64url')` + 접두사
- `sha256` 해시만 저장. **발급 순간 1회만 노출**, 이후 재조회 불가
- 재생성 = 새 값 + 기존 `revoked_at` 설정. 구 토큰 즉시 사망
- `last_used_at` 갱신 — 유출 시 "이 토큰이 아직 살아있나"를 판단할 유일한 수단

### 부트스트랩

`ADMIN_EMAILS`에 든 사람이 첫 로그인 → 레포 생성 → sync 토큰 발급 → 멤버 등록.

### 반환 규약

서버 액션은 예외를 던지지 않고 통일한다.

```ts
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
```

사용자에게는 일반적인 메시지만. 내부 에러는 `console.error`로 서버 로그에만.

---

## 7. MCP 서버 (원격 HTTP) — 토큰 절감의 본체

Next.js 라우트 핸들러(`/api/mcp`)로 Streamable HTTP MCP를 서빙. 인증은 Bearer access token.
**읽기 전용 — 쓰기 툴 없음.**

| 툴 | 인자 | 반환 | 목적 |
|---|---|---|---|
| `spec_outline` | `repo?` | 문서 목록 + 각 문서의 `##` 헤딩만 | **가장 큰 절감.** ~200토큰으로 "뭐가 있는지" 파악 후 필요한 것만 요청. `repo` 생략 시 접근 가능한 전체 (교차 조회) |
| `spec_get` | `repo, path, heading?, if_none_match?` | 문서·섹션, 또는 `{unchanged:true}` | 해시가 같으면 본문 대신 5토큰 |
| `spec_search` | `repo?, query` | 매칭된 섹션 상위 N개 | substring 스코어링. **임베딩·벡터DB 금지** — 스펙 수십 개 규모에서 정당화 안 된다 |
| `spec_changes_since` | `repo?, since?` | 커서 이후 `sync_events` 요약 | `since` 생략 시 저장된 커서 사용 후 전진 |

- 섹션 분할은 `^## ` 기준 문자열 split. 마크다운 파서 의존성 불필요
- 권한 없는 레포는 응답에 애초에 등장하지 않는다

### 구독 — 폴링도 커넥션도 없이 (P7)

"항상 최신"을 폴링으로 풀면 토큰이 샌다. 반대로 간다: **커서를 서버가 기억하고, 이미 하는 호출에 얹는다.**

- **아무 툴 응답 끝에**, `token_cursors` 기준으로 밀렸을 때만 한 줄:
  `[stale] .specs/features.md changed — call spec_changes_since`
- 안 밀렸으면 그 줄이 **아예 없다 → 추가 비용 0**
- `spec_changes_since()` 인자 없이 호출 → 커서 이후 요약만 반환하고 커서 전진

추가 라운드트립 0, 열린 연결 0, 폴링 0. MCP 표준의 `resources/subscribe` 푸시는 클라이언트 지원이 갈려 v1에서 쓰지 않는다.

### 에이전트에게 사용법을 알리는 3층

1. **툴 `description`** — 각 툴의 용도와 호출 시점. 에이전트가 읽는 1차 소스
2. **서버 `instructions`** (MCP `initialize` 응답) — **호출 순서**를 박는다:
   *"스펙 파일을 통째로 읽지 말 것. `spec_outline` → 필요한 섹션만 `spec_get`. `[stale]` 표시를 보면 `spec_changes_since`."*
   매 세션 실리므로 **100토큰 이내**
3. **각 프로젝트 `AGENTS.md`에 3줄** — 이게 없으면 에이전트는 그냥 로컬 파일을 읽는다. **툴이 있다고 쓰는 게 아니다.** 안 쓰면 Cushion은 순수 손해다

### 팀원 설정

`.mcp.json`은 커밋되므로 **토큰을 박지 않는다**, 환경변수 확장을 쓴다:

```json
{
  "mcpServers": {
    "cushion": {
      "type": "http",
      "url": "https://<cushion>/api/mcp",
      "headers": { "Authorization": "Bearer ${CUSHION_TOKEN}" }
    }
  }
}
```

---

## 8. 알림

`/api/sync` 수신 시 해당 레포의 Mattermost incoming webhook에 POST (Slack 호환 `{ "text": ... }`).

- **레포당 채널 하나.** 개인별 구독은 실제로 시끄러워진 다음에 — 전원 발송은 2주 안에 뮤트되고 기능이 죽는다
- 요약은 `sync_events.summary`에 저장해 `spec_changes_since`가 **재사용**한다. 두 번 만들면 두 번 드리프트한다

### 요약은 LLM을 쓰지 않는다 (v1)

**본문 = 변경 파일 + 바뀐 `##` 헤딩 + 증감 줄 수 + 커밋 메시지 + GitHub 링크.**

```
.specs/features.md — 인증, 댓글 (+18 −4)
AGENTS.md — 상태 관리 (+2 −11)
삭제: .specs/editor.md
"세션 만료 정책 변경" — neruu00
```

diff가 짧으면(예: 40줄 이하) 원문 diff를 그대로 덧붙인다. 스펙 diff는 산문이라 그 자체로 읽힌다.

**LLM 요약을 넣지 않는 이유** — 요약 모델이 보는 건 diff 텍스트뿐이라 "어느 코드가 영향받는지"는 알 수 없다. 판단이 추측이 되고, 틀린 추측 한 번이면 알림을 안 읽게 된다. 에이전트 쪽은 더 분명하다: `spec_changes_since`가 산문 요약을 줘도 실제 내용은 `spec_get`으로 다시 가져와야 하므로, **경로+헤딩 목록이 요약보다 싸고 더 유용하다.** outline-first와 같은 논리다.

**넣을 시점**: 구조적 요약으로 "뭐가 바뀐 건지 모르겠다"는 말이 실제로 나올 때. 그때도 스키마 변경 없이 `summary` 생성 함수만 교체하고, **LLM 실패 시 구조적 요약으로 떨어지게(fail-open)** 붙인다.

---

## 9. 화면 (shadcn/ui + Tailwind v4)

전원 개발자이므로 얇게. **편집 화면 없음.**

| 경로 | 내용 |
|---|---|
| `/` | 접근 가능한 레포 목록 |
| `/[repo]` | 문서 목록 + 최근 변경(`sync_events`) 타임라인 |
| `/[repo]/[...path]` | 문서 보기 + GitHub 원본 링크 |
| `/settings/tokens` | access token 발급·재생성 (직후 1회 노출) |
| `/admin` | 레포 생성, sync 토큰 발급, 멤버 등록/삭제, webhook URL — admin만 |

### 셋업

```
npx shadcn@latest init
npx shadcn@latest add button input card table badge dialog dropdown-menu sonner alert skeleton
```

**화면이 실제로 쓰는 것만 추가한다.** 미리 다 깔지 않는다.

### 마크다운 렌더는 서버에서

`react-markdown` + `remark-gfm` + `rehype-highlight`를 **서버 컴포넌트**에서 실행 → 클라이언트 번들 0.
본문 타이포는 `@tailwindcss/typography`의 `prose`.

### 그 외

- **서버 컴포넌트가 기본.** `'use client'`는 토큰 복사 버튼, 삭제 확인 다이얼로그 같은 최소 리프에만
- shadcn 기본 토큰을 그대로 쓴다. 커스텀 팔레트를 새로 만들지 않는다
- 다크모드 토글은 v1에서 뺀다 (`next-themes` 미도입)
- **`/admin`의 레포 생성 직후 화면에 `cushion-sync.yml`과 `.mcp.json`을 복붙 가능한 형태로 그대로 출력한다.** 별도 설치 가이드 문서를 만들지 않아도 된다

---

## 10. 환경변수

| 키 | 용도 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | |
| `SUPABASE_SERVICE_ROLE_KEY` | DB 접근 | **RLS 전면 우회** — 모든 라우트가 스스로 권한 검사 |
| `NEXTAUTH_URL` | 콜백 베이스 URL | |
| `NEXTAUTH_SECRET` | 세션 서명 | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth | |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | |
| `ADMIN_EMAILS` | admin 이메일 콤마 구분 | **비면 전원 거부** |

**LLM API 키는 없다.** 요약이 구조적이라 외부 AI 프로바이더 의존성이 v1에 존재하지 않는다 (§8).

Google OAuth는 블로그 프로젝트의 클라이언트를 재사용한다 — GCP 콘솔에서 승인된 리디렉션 URI에 `http://localhost:3000/api/auth/callback/google`(및 배포 도메인)을 추가하면 끝.

**DB에 있고 환경변수가 아닌 것**: Mattermost webhook URL(레포별), sync 토큰(앱이 발급), access 토큰(앱이 발급).

`.env.local`은 커밋하지 않는다.

---

## 11. 검증

### 1. 토큰 절감 실측 (제일 중요 — 이게 전제 전체다)

숫자가 안 나오면 이 도구는 존재 이유가 없다.

- 대조군: 스펙 전량 로드 토큰 수
- 실험군: `spec_outline` + 실제로 필요했던 섹션 1~2개
- 실제 작업 3건으로 비교
- **최신 상태에서 `[stale]` 줄이 응답에 없는지** 확인 (구독 비용 0의 근거)

### 2. 권한 (자동화 없이 손으로라도 전부)

- 미등록 이메일 로그인 → 레포 목록 빈 화면, URL 직접 입력 시 404
- 멤버에서 제거 → **기존 토큰으로 즉시 차단**되는지 (요청 시점 조회의 핵심 검증)
- `ADMIN_EMAILS` 빈 값 → `/admin` 거부 (fail-closed)
- `A@x.com` 등록 후 `a@x.com` 로그인 → 접근됨 (정규화)
- 토큰 재생성 후 구 토큰 → 401
- **sync 토큰으로 `/api/mcp` 호출 → 거부** (토큰 종류 분리)
- 레포 A의 sync 토큰으로 레포 B 갱신 시도 → 거부
- 서버 액션을 세션 없이 직접 호출 → 거부

### 3. 동기화

- 스펙 1개 수정 push → 미러 반영 + Mattermost 수신
- **스펙 파일 삭제 push → 미러에서도 사라지는지**
- `workflow_dispatch` 전체 동기화 → 신규 레포가 전량 채워지는지
- 신규 브랜치 push(`before` all-zeros) → 죽지 않고 스냅샷 폴백
- 스펙 외 파일만 바뀐 push → 트리거 안 됨

### 4. 구독

- 에이전트가 `spec_get` 호출 → 다른 사람이 push → 다음 툴 호출 응답에 `[stale]` 등장
- `spec_changes_since()` 호출 → 요약 반환 후 커서 전진 → 다음 호출에 `[stale]` 사라짐
- `if_none_match`에 현재 sha → `{unchanged:true}`

### 5. MCP

`npx @modelcontextprotocol/inspector`로 4개 툴 + `instructions` 확인 → Claude Code에서 `.mcp.json` + `CUSHION_TOKEN`으로 붙여 "스펙 목차 보여줘" 호출 확인. Cushion을 내려도 로컬 파일 읽기로 작업이 계속되는지.

### 6. 알림 품질

받은 메시지 3건이 **링크를 열지 않고** "나에게 영향 있나"를 판단하게 하는지.
못 하면 그때가 LLM 요약을 검토할 시점이다(§8) — 그 전엔 아니다.

---

## 12. 나중에 (지금 만들지 않는다)

| 추가 시점 | 무엇 |
|---|---|
| 구조적 요약으로 "뭐가 바뀐지 모르겠다"가 나올 때 | LLM diff 요약 — `summary` 생성 함수만 교체, 실패 시 fail-open (§8) |
| 알림이 시끄러워졌을 때 | 개인별 구독 규칙 |
| 코드-스펙 드리프트를 잡고 싶을 때 | `github_full_name` 활용 — 코드 변경 있고 연결된 스펙 변경 없으면 PR 코멘트 |
| 클라이언트 지원이 확인됐을 때 | MCP `resources/subscribe` 실시간 푸시 (지금은 커서로 충분) |
| 비개발자가 스펙을 **써야** 할 때 | 제안 → PR 자동 생성 (원본은 계속 git) |
| substring 검색이 부족해질 때 | `to_tsvector` + GIN → 그래도 안 되면 임베딩 |
| 토큰 유출 대응이 필요해졌을 때 | 접근 감사 로그 (지금은 `last_used_at` 하나로 버틴다) |
