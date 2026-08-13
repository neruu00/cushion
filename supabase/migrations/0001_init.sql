-- Cushion 초기 스키마
-- 실행: Supabase Dashboard > SQL Editor 에 붙여넣고 Run
--
-- 설계 근거는 SPEC.md §5. 요약:
--  - 유저 테이블 없음. 정체성은 NextAuth가, 허용 여부는 repository_members 행 존재가 결정
--  - 문서 원본은 git. 여기 있는 documents는 미러이므로 version/이력 컬럼 없음
--  - 이메일은 애플리케이션에서 lowercase 정규화 후 저장·조회 (아래 CHECK로 강제)

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- repositories
-- ─────────────────────────────────────────────────────────────
create table if not exists repositories (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,
  name                    text not null,
  github_full_name        text,                    -- 'org/repo'. 원본 링크 + 후일 드리프트 감지
  mattermost_webhook_url  text,                    -- 레포당 채널 1개
  sync_token_hash         text unique,             -- sha256(cshn_sync_...). 평문 저장 금지
  created_at              timestamptz not null default now(),

  constraint repositories_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$')
);

-- ─────────────────────────────────────────────────────────────
-- repository_members — 접근 허용 목록 + 레포 권한
-- 행이 0개인 이메일 = 로그인해도 아무것도 못 봄 (SPEC P3)
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
-- documents — 스펙 미러
-- ─────────────────────────────────────────────────────────────
create table if not exists documents (
  id             uuid primary key default gen_random_uuid(),
  repository_id  uuid not null references repositories(id) on delete cascade,
  path           text not null,                    -- 레포 루트 기준 ('.specs/features.md')
  title          text,                             -- 첫 '# ' 헤딩. 없으면 null
  content        text not null,
  content_sha    text not null,                    -- sha256(content). spec_get if_none_match용
  commit_sha     text,
  updated_at     timestamptz not null default now(),

  unique (repository_id, path)
);

-- ─────────────────────────────────────────────────────────────
-- sync_events — 델타 피드 + 알림 원본
-- ─────────────────────────────────────────────────────────────
create table if not exists sync_events (
  id             bigserial primary key,
  repository_id  uuid not null references repositories(id) on delete cascade,
  commit_sha     text,
  author         text,
  message        text,
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
-- RLS
-- 이 앱은 service_role 키로만 DB에 접근하며 service_role은 RLS를 우회한다.
-- 그래도 RLS를 켜 두는 이유: anon/authenticated 키가 어떤 경로로든 노출됐을 때
-- 정책이 하나도 없는 테이블은 전부 거부되기 때문이다. fail-closed 기본값.
-- 권한 검사의 실체는 애플리케이션 코드에 있다 (SPEC §6).
-- ─────────────────────────────────────────────────────────────
alter table repositories        enable row level security;
alter table repository_members  enable row level security;
alter table documents           enable row level security;
alter table sync_events         enable row level security;
alter table access_tokens       enable row level security;
alter table token_cursors       enable row level security;
