<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

> 위 블록은 `next dev`가 관리한다. 손대지 말고 아래에만 쓴다.

---

# Cushion

**에이전트를 1차 독자로 삼은 문서 도서관.** 스펙·ADR·런북·회의록·용어집 — 프로젝트 문서를 한곳에 두고, 팀에는 변경 알림을 보내고 에이전트에는 MCP로 **필요한 조각만** 읽고 쓰게 한다. 목적은 하나 — **에이전트가 같은 문서를 반복해서 컨텍스트에 싣느라 태우는 토큰을 줄이는 것.**

**`SPEC.md`와 `PLAN.md`는 이 레포에 없다.** Cushion 자신이 갖고 있다(D-011) —
MCP 서버 `cushion`으로 읽는다. 이 문서는 **코드에서 읽어낼 수 없는 규칙과 함정**만 담는다.

```
doc_outline               # 목차부터
doc_get(library:"cushion", path:"SPEC.md", heading:"6. 인증 · 권한")
```

붙어 있지 않다면 `/settings/tokens`에서 발급하고 명령 한 줄을 실행한다.
웹으로는 <https://cushion-chi.vercel.app/libraries/cushion>.

**이 문서(`AGENTS.md`)와 `CLAUDE.md`는 레포에 남는다.** Claude Code가 세션 시작에 자동으로
읽는 파일이라 Cushion에 두면 아무도 규칙을 안 읽는다 — 붙기 _전에_ 필요한 문서다.

---

## 명령어

| 목적          | 명령                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| 개발 서버     | `pnpm dev` (Turbopack, :3000)                                                  |
| 타입 검사     | `pnpm typecheck`                                                               |
| 린트          | `pnpm lint`                                                                    |
| 테스트        | `pnpm test` — `node --test`. 러너 없음, `*.test.ts` 직접 실행                  |
| 인수 검증     | `pnpm acceptance` — SPEC §11을 실 DB로 관통한다. **dev 서버가 떠 있어야 한다** |
| 빌드          | `pnpm build`                                                                   |
| **전체 검증** | `pnpm verify` — 타입 + 린트 + 테스트 + 빌드                                    |

패키지 매니저는 **pnpm 고정**. `pnpm verify`가 통과해야 작업이 끝난 것이다. 빌드가 깨진 채로 완료라고 보고하지 않는다.

---

## 반드시 알아야 할 것

모르면 사고가 나는 것들. 코드를 읽어서는 알기 어렵다.

### 1. 이건 네가 아는 Next.js가 아니다 (16.x)

맨 위 블록이 진심이다. **라우팅·요청 API·캐시 API를 건드리기 전에 `node_modules/next/dist/docs/`의 해당 문서를 읽는다.** 15와 다른 지점:

| 항목                                            | Next 16                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| 미들웨어                                        | **`middleware.ts` → `proxy.ts`**, 함수명도 `proxy`. edge 런타임 불가(nodejs 고정) |
| `cookies()`·`headers()`·`params`·`searchParams` | **동기 접근 완전 제거** — 전부 `await`                                            |
| `revalidateTag`                                 | 2번째 인자(cacheLife) **필수**. 즉시 반영은 `updateTag`(서버 액션 전용)           |
| 린트                                            | `next lint` 삭제. `next build`가 린트를 돌리지 않으므로 `pnpm verify`로 따로 돈다 |
| 타입 헬퍼                                       | `pnpm exec next typegen` → `PageProps<'/x/[id]'>`, `LayoutProps`, `RouteContext`  |

### 2. Supabase 클라이언트는 `service_role`이다 — RLS가 없다

테이블에 RLS는 켜져 있지만 **정책이 0개**다. service_role은 RLS를 우회하므로 사실상 무제한 접근이고, 정책 0개는 anon 키가 유출됐을 때 전부 거부시키기 위한 fail-closed 장치일 뿐이다.

**따라서 모든 서버 액션과 API 라우트가 스스로 권한을 검사해야 한다.** `proxy.ts`는 서버 액션 호출을 막지 못한다 — 그것만 믿고 액션에서 검사를 생략하면 그대로 뚫린다.

순서를 지킨다: **권한 확인 → Zod 검증 → 로직 → 재검증**

```ts
export async function createLibrary(formData: FormData) {
  if (!(await isAdmin()))
    return { success: false, error: "관리자 권한이 필요합니다." };
  // ...
}
```

### 3. 권한에서 절대 깨뜨리면 안 되는 4가지

- **`ADMIN_EMAILS`가 비면 전원 거부**(fail-closed). 빈 값을 "제한 없음"으로 읽는 순간 전면 개방이다.
  적용 범위는 `/admin`(전체 조망·내보내기)이다 — 레포 생성은 로그인만으로, 멤버 관리는 그 레포 멤버면 된다 (D-013)
- **이메일은 쓸 때·조회할 때 양쪽에서 `lowercase`.** DB `CHECK` 제약이 있지만 조회 경로는 막아주지 않는다. 대소문자 차이 = ACL 우회 구멍
- **토큰에 권한을 굽지 않는다.** 토큰은 이메일까지만 해석하고, 레포 권한은 **요청 시점에 `library_members`를 조회**한다. 멤버에서 빼면 토큰 재발급 없이 즉시 차단돼야 한다
- **권한 없는 레포는 403이 아니라 404.** 403은 "그 레포가 존재한다"를 알려준다

### 4. 토큰은 이제 읽기 전용이 아니다

`cshn_pat_` 하나뿐이고, **읽기와 쓰기를 모두 할 수 있다**(D-011). 유출되면 열람만이 아니라
스펙 훼손까지 가능하다는 뜻이다. 그래서 지켜야 할 것:

- **sha256 해시만 저장**하고 발급 순간 1회만 노출한다. 평문 저장 경로를 만들지 않는다
- `last_used_at`을 갱신한다 — 유출 시 "이 토큰이 아직 살아있나"를 판단할 유일한 수단
- 재발급 = 새 값 + 기존 `revoked_at` 설정. 구 토큰 즉시 사망
- 훼손 복구의 근거는 `document_versions`뿐이다. 그 경로를 깨뜨리지 않는다

### 5. 원본은 여기다. git이 아니다 (D-011)

`documents`는 캐시가 아니라 **원본**이다. 되돌릴 git이 없다.

- **쓰기는 `lib/document.ts` 하나를 지난다.** 웹 편집 화면도 MCP 쓰기 툴도 거기로 모인다.
  두 벌로 만들면 한쪽만 이력을 남기거나 한쪽만 잠금을 확인하는 날이 온다
- **`base_sha` 없이 기존 문서를 덮지 않는다.** 읽을 때 준 sha를 쓸 때 되받고, 어긋나면
  거부한 뒤 현재 sha를 알려준다. **병합하지 않는다** — 브랜치가 없어 병합할 근거가 없다
- **본문을 덮기 전에 `document_versions`에 이전 것을 남긴다.** append-only.
  삭제할 때도 남긴다 — 삭제야말로 되돌릴 수 있어야 한다
- **이력은 읽히는 경로가 있어야 한다.** 쓰기만 하고 못 꺼내면 없는 것보다 나쁘다 —
  해결된 것처럼 보이기 때문이다. `/[library]/history/[...path]`가 그 리더고,
  거기서 `lib/diff.ts`가 버전 사이 변경을 hunk로 보여준다. 전문 보기도 남겨 둔다 —
  diff가 상한에 걸려 생략될 때 그게 유일한 수단이다
- **되돌리기는 덮어쓰기가 아니라 새 저장이다.** append-only를 지켜야
  "언제 무엇으로 되돌렸나"가 남는다
- **`/api/export`가 유일한 백업이다.** 이걸 깨뜨리면 탈출구가 없어진다

### 6. 쓰기 경로의 뒷정리를 빠뜨리지 않는다

한 번의 편집은 네 가지를 남겨야 한다 — 이력, 본문, `sync_events`, 알림.
하나라도 빠지면 조용히 어긋난다: 이력이 없으면 못 되돌리고, 이벤트가 없으면 에이전트가
변경을 모르고(`[stale]`이 안 뜬다), 알림이 없으면 팀이 모른다.

`lib/mirror.ts`의 `recordVersion` + `recordChange`가 그 뒷정리다. 쓰기 경로를 새로 만들면
**거기도 반드시 지나게 한다.**

---

## 들여오지 않는 것

기각 이유는 Cushion의 `PLAN.md` 결정 로그에 있다. **다시 제안하기 전에 `doc_get`으로 읽어라.**

- **LLM diff 요약** — 요약 모델은 본문만 보므로 "어느 코드가 영향받는지" 판단이 추측이 된다. 구조적 요약(경로 + 섹션 + 증감)으로 간다 (D-002)
- **git 동기화 / sync 토큰** — 원본이 Cushion이다. 되살리면 원본이 둘이 된다 (D-011)
- **자동 병합 / 충돌 해결 UI** — 브랜치가 없어 병합할 근거가 없다. `base_sha`로 거부만 한다
- **유저 테이블** — `library_members` 한 테이블이 "등록됐나"와 "어느 레포"를 동시에 답한다 (D-003)
- **임베딩 · 벡터 DB** — 스펙 수십 개 규모에서 substring 스코어링으로 충분 (D-004)
- **폴링 · 상시 연결 구독** — 커서 + 응답에 얹는 `[stale]` 한 줄로 대체 (D-005)
- **개인별 알림 구독 / 브라우저 푸시 / SMS** — 레포당 Mattermost 채널 하나
- **다크모드 토글** — shadcn 기본 토큰 그대로

---

## 코드 규칙

### 파일명

| 종류       | 패턴              | 예시                    |
| ---------- | ----------------- | ----------------------- |
| 컴포넌트   | PascalCase `.tsx` | `RepoCard.tsx`          |
| 서버 액션  | 도메인명 `.ts`    | `actions/repository.ts` |
| Zod 스키마 | `*.schema.ts`     | `document.schema.ts`    |
| 타입       | `*.type.ts`       | `document.type.ts`          |

### TypeScript

- `strict: true`. `any` 금지 — 불가피하면 `unknown` + 타입 가드
- 외부 입력(MCP 툴 인자, formData)은 `as`로 단언하지 말고 **Zod `safeParse`로 검증**한다. 이게 신뢰 경계다
- Props는 `interface`로, 컴포넌트 바로 위에 선언

### 서버 액션 반환

예외를 던지지 말고 통일한다.

```ts
type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
```

사용자에게는 일반적인 메시지만. 내부 에러는 `console.error`로 서버 로그에만 남긴다. 로거 라이브러리를 넣지 않는다.

### 컴포넌트

**서버 컴포넌트가 기본.** `'use client'`는 토큰 복사 버튼·확인 다이얼로그 같은 **최소 리프**에만 붙인다.

마크다운 렌더는 **서버 컴포넌트에서** 한다(`react-markdown`) — 클라이언트 번들 0. 보기 화면에 에디터 런타임을 싣지 않는다. 편집은 별도 라우트(`/[library]/edit/…`)의 textarea다.

UI는 shadcn/ui(base·nova = Base UI + Lucide + Geist). 아이콘은 **`lucide-react`만**. 화면이 실제로 쓰는 컴포넌트만 `pnpm dlx shadcn@latest add`로 추가한다 — 미리 다 깔지 않는다.

### 주석

파일 상단에 `@file` / `@description`. 인라인 주석은 **왜(Why)**를 쓴다. 주석 처리된 죽은 코드는 커밋하지 않는다.

---

## 작업 방식

### 확인하고 진행할 것

- **커밋·푸시**: 요청받았을 때만. `main`에 직접 커밋하지 않고 브랜치를 만든다
- **DB 마이그레이션**: `supabase/migrations/`에 SQL을 작성해서 보여주고, **실행은 사람이 한다**
- **의존성 추가**: 이미 설치된 패키지나 플랫폼 기본 기능으로 되는지 먼저 확인한다
- **파일 삭제**: 참조가 정말 0건인지 확인한 뒤 지운다

### 환경변수

`.env.local`은 절대 커밋하지 않는다(`.gitignore`가 `.env*`를 덮고 `.env.example`만 예외). **값을 대화에 출력하지 않는다.** 키를 추가하면 `.env.example`에도 이름만 추가한다.

### 문서 갱신

코드를 바꾸면 어긋난 문서도 같이 고친다. 문서가 코드와 어긋나면 다음 작업자가 그 문서를 믿고 잘못된 코드를 쓴다 — 이 프로젝트가 존재하는 이유가 그거다.

---

## AI 에이전트에게

- **이 문서와 어긋나는 코드를 발견하면 고치기 전에 알린다.** 문서가 틀렸을 수도 있다
- **SPEC과 코드가 다르면 코드가 정답이다.** 문서를 고치고, 고쳤다고 알린다
- 즉석에서 해결하기 어려운 문제를 발견하면 **Cushion의 `PLAN.md`에** 항목으로 남긴다(`doc_put`). 조용히 넘기지 않는다
- 규칙에 예외를 두어야 한다면 **이유를 코드 주석에 남긴다**

## 참고 문서

| 문서                           | 어디에      | 내용                                           |
| ------------------------------ | ----------- | ---------------------------------------------- |
| `SPEC.md`                      | **Cushion** | 무엇을·왜. 데이터 모델, MCP 툴 명세, 검증 항목 |
| `PLAN.md`                      | **Cushion** | 현재 상태, 다음 작업, **결정 로그**            |
| `README.md`                    | 레포        | 클론한 사람이 보는 첫 화면                     |
| `supabase/migrations/`         | 레포        | **DB 스키마의 원본**                           |
| `node_modules/next/dist/docs/` | 레포        | 설치된 버전에 맞는 Next.js 문서                |

코드 주석의 `(SPEC §6)`·`(D-011)` 같은 인용은 그대로 유효하다 — 섹션 번호는 Cushion에서도 같다.
