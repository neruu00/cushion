-- Cushion 스키마 전체. **이 파일 하나가 DB 스키마의 원본이다.**
-- 실행: Supabase Dashboard > SQL Editor 에 붙여넣고 Run
--
-- 전부 멱등하다 — 빈 DB에 돌리면 새로 만들고, 이미 쓰는 DB에 돌리면 모자란 것만 채운다.
-- 마이그레이션을 번호대로 쌓지 않는 이유: 이 프로젝트에는 DB가 하나뿐이고 마이그레이션
-- 러너도 없다. 파일이 여러 개면 "지금 스키마가 무엇인가"를 네 파일을 읽어야 알게 된다.
-- 무엇이 언제 바뀌었나는 git log가 답한다.
--
-- ⚠️ 아래 [정리] 절은 컬럼을 **지운다**. D-011 이전 코드가 아직 떠 있다면 그 배포의
--    /api/sync가 500이 된다(이미 죽은 경로다). 순서를 지키려면 새 코드를 배포한 뒤 돌리고,
--    그 전에 /admin > 전체 내보내기로 문서를 받아 둘 것.
--
-- 설계 근거는 Cushion의 SPEC §5, PLAN의 D-003·D-011·D-012·D-013. 요약:
--  - 유저 테이블 없음. 정체성은 NextAuth가, 접근 허용은 repository_members 행 존재가 결정
--  - documents는 캐시가 아니라 **원본**이다. git history가 하던 일을 document_versions가 한다
--  - 동시 편집은 content_sha 낙관적 잠금으로 막는다. 병합하지 않는다

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- repositories
-- ─────────────────────────────────────────────────────────────
create table if not exists repositories (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,
  name                    text not null,
  github_full_name        text,                    -- 'org/repo'. 원본 링크용
  -- 알림 채널. 둘 다 둘 수 있다 — 페이로드 키가 다르다(Mattermost {text}, Discord {content}).
  mattermost_webhook_url  text,
  discord_webhook_url     text,
  -- 최신 이벤트 id 비정규화 (D-012). 갱신은 lib/mirror.ts recordChange 한 곳뿐이다.
  latest_event_id         bigint not null default 0,
  created_at              timestamptz not null default now(),

  constraint repositories_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$')
);

-- ─────────────────────────────────────────────────────────────
-- repository_members — 접근 허용 목록 + 레포 권한
-- 행이 0개인 이메일 = 로그인해도 아무것도 못 봄 (SPEC P3)
-- 레포를 만든 사람이 첫 행이 된다 (D-013 셀프서브)
-- ─────────────────────────────────────────────────────────────
create table if not exists repository_members (
  repository_id  uuid not null references repositories(id) on delete cascade,
  email          text not null,
  created_at     timestamptz not null default now(),

  primary key (repository_id, email),
  -- 대소문자 차이가 곧 ACL 우회 구멍이다. DB에서도 막는다.
  constraint repository_members_email_lower check (email = lower(email))
);

create index if not exists repository_members_email_idx on repository_members (email);

-- ─────────────────────────────────────────────────────────────
-- documents — 스펙 **원본** (D-011). 되돌릴 git이 없다.
-- ─────────────────────────────────────────────────────────────
create table if not exists documents (
  id             uuid primary key default gen_random_uuid(),
  repository_id  uuid not null references repositories(id) on delete cascade,
  path           text not null,                    -- 레포 루트 기준 ('SPEC.md')
  title          text,                             -- 첫 '# ' 헤딩. 없으면 null
  content        text not null,
  content_sha    text not null,                    -- sha256(content). 읽기 ETag이자 쓰기 CAS 키
  updated_by     text,                             -- git의 author를 대신한다
  updated_at     timestamptz not null default now(),

  unique (repository_id, path)
);

-- ─────────────────────────────────────────────────────────────
-- document_versions — 이력. 원본이 DB에 있으니 "되돌리기"의 유일한 근거다.
-- append-only로만 쓴다. update/delete 경로를 만들지 않는다.
--
-- documents(id)를 참조하지 **않는다**. 참조하면 문서를 지울 때 이력이 같이 사라지는데,
-- 삭제야말로 되돌릴 수 있어야 하는 사건이다. 안정적인 키인 (레포, 경로)에 매단다 —
-- 같은 경로에 다시 만들면 이력이 이어지는 것도 이 편이 맞다.
-- ─────────────────────────────────────────────────────────────
create table if not exists document_versions (
  id            bigserial primary key,
  repository_id uuid not null references repositories(id) on delete cascade,
  path          text not null,
  content       text not null,
  content_sha   text not null,
  author        text not null,
  note          text,                               -- 편집 메모. 커밋 메시지 자리
  created_at    timestamptz not null default now(),

  constraint document_versions_author_lower check (author = lower(author))
);

create index if not exists document_versions_path_idx
  on document_versions (repository_id, path, id desc);

-- ─────────────────────────────────────────────────────────────
-- sync_events — 델타 피드 + 알림 원본
-- ─────────────────────────────────────────────────────────────
create table if not exists sync_events (
  id             bigserial primary key,
  repository_id  uuid not null references repositories(id) on delete cascade,
  author         text,
  changed_paths  text[] not null default '{}',
  deleted_paths  text[] not null default '{}',
  summary        text,                             -- 구조적 요약 (SPEC §8). LLM 아님
  created_at     timestamptz not null default now()
);

create index if not exists sync_events_repo_id_idx on sync_events (repository_id, id desc);

-- ─────────────────────────────────────────────────────────────
-- access_tokens — 에이전트용. 사람 단위
-- ─────────────────────────────────────────────────────────────
create table if not exists access_tokens (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  token_hash    text not null unique,              -- sha256(cshn_pat_...). 평문 저장 금지
  name          text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,                       -- 유출 시 생사 판단용 (SPEC §6)
  revoked_at    timestamptz,

  constraint access_tokens_email_lower check (email = lower(email))
);

-- 유효 토큰 조회 경로. 폐기된 토큰은 인덱스에서 빠진다
create index if not exists access_tokens_active_idx
  on access_tokens (token_hash) where revoked_at is null;

create index if not exists access_tokens_email_idx on access_tokens (email);

-- ─────────────────────────────────────────────────────────────
-- token_cursors — 구독 커서. "에이전트가 최신을 안다"의 전부 (SPEC P7)
-- ─────────────────────────────────────────────────────────────
create table if not exists token_cursors (
  token_id       uuid not null references access_tokens(id) on delete cascade,
  repository_id  uuid not null references repositories(id) on delete cascade,
  last_event_id  bigint not null default 0,
  updated_at     timestamptz not null default now(),

  primary key (token_id, repository_id)
);

-- ─────────────────────────────────────────────────────────────
-- 이미 만들어진 DB 수렴
-- 위 create table은 테이블이 있으면 통째로 건너뛴다 — 나중에 생긴 컬럼은 여기서 채운다.
-- ─────────────────────────────────────────────────────────────
alter table repositories add column if not exists discord_webhook_url text;
alter table repositories add column if not exists latest_event_id bigint not null default 0;
alter table documents    add column if not exists updated_by text;

alter table documents drop constraint if exists documents_updated_by_lower;
alter table documents add constraint documents_updated_by_lower
  check (updated_by is null or updated_by = lower(updated_by));

-- latest_event_id 백필. 이미 채워져 있으면 같은 값으로 덮으므로 여러 번 돌려도 같다.
update repositories r
set latest_event_id = coalesce((select max(id) from sync_events e where e.repository_id = r.id), 0);

-- ─────────────────────────────────────────────────────────────
-- [정리] 죽은 컬럼 — 되돌릴 수 없다
-- 읽는 코드가 0건임을 확인하고 지운다. git 동기화를 들어낸 D-011의 잔재다.
-- ─────────────────────────────────────────────────────────────
alter table documents    drop column if exists commit_sha;       -- 가리킬 커밋이 없다
alter table repositories drop column if exists sync_token_hash;  -- 레포가 미는 경로가 없다
alter table sync_events  drop column if exists commit_sha;
alter table sync_events  drop column if exists message;          -- note와 summary에 이미 있다

-- ─────────────────────────────────────────────────────────────
-- RLS
-- 이 앱은 service_role 키로만 DB에 접근하며 service_role은 RLS를 우회한다.
-- 그래도 RLS를 켜 두는 이유: anon/authenticated 키가 어떤 경로로든 노출됐을 때
-- 정책이 하나도 없는 테이블은 전부 거부되기 때문이다. fail-closed 기본값.
-- 권한 검사의 실체는 애플리케이션 코드에 있다 (SPEC §6).
-- ─────────────────────────────────────────────────────────────
alter table repositories        enable row level security;
alter table repository_members  enable row level security;
alter table documents           enable row level security;
alter table document_versions   enable row level security;
alter table sync_events         enable row level security;
alter table access_tokens       enable row level security;
alter table token_cursors       enable row level security;
