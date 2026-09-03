-- Cushion 스키마 전체. **이 파일 하나가 DB 스키마의 원본이다.**
-- 실행: Supabase Dashboard > SQL Editor 에 붙여넣고 Run
--
-- 전부 멱등하다 — 빈 DB에 돌리면 새로 만들고, 이미 쓰는 DB에 돌리면 모자란 것만 채운다.
-- 마이그레이션을 번호대로 쌓지 않는 이유: 이 프로젝트에는 DB가 하나뿐이고 마이그레이션
-- 러너도 없다. 파일이 여러 개면 "지금 스키마가 무엇인가"를 여러 파일을 읽어야 알게 된다.
-- 무엇이 언제 바뀌었나는 git log가 답한다.
--
-- ⚠️ [정리] 절은 컬럼을 **지운다**. 돌리기 전에 /admin > 전체 내보내기로 문서를 받아 둘 것.
--
-- 설계 근거는 Cushion의 SPEC §5, PLAN의 D-003·D-011·D-012·D-013. 요약:
--  - users 테이블은 로그인 기록만 남긴다. 접근 허용은 library_members 행 존재가 결정
--  - documents는 캐시가 아니라 **원본**이다. git history가 하던 일을 document_versions가 한다
--  - 동시 편집은 content_sha 낙관적 잠금으로 막는다. 병합하지 않는다

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- [이관] repositories → libraries
--
-- **반드시 create보다 먼저다.** 순서를 바꾸면 `create table if not exists libraries`가
-- 빈 테이블을 새로 만들고, 데이터는 옛 repositories에 남아 둘로 갈린다.
--
-- 이름을 바꾼 이유: 이건 git 레포의 거울이 아니라 여러 레포가 함께 보는 **문서 서가**다.
-- FE·BE 레포가 API 계약 문서 하나를 같이 보는 게 창립 유스케이스다.
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.repositories') is not null and to_regclass('public.libraries') is null then
    alter table repositories rename to libraries;
  end if;
  if to_regclass('public.repository_members') is not null and to_regclass('public.library_members') is null then
    alter table repository_members rename to library_members;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['library_members', 'documents', 'document_versions', 'sync_events', 'token_cursors']
  loop
    if to_regclass('public.' || t) is not null
       and exists (select 1 from information_schema.columns
                   where table_name = t and column_name = 'repository_id')
       and not exists (select 1 from information_schema.columns
                       where table_name = t and column_name = 'library_id')
    then
      execute format('alter table %I rename column repository_id to library_id', t);
    end if;
  end loop;
end $$;

alter index if exists repository_members_email_idx rename to library_members_email_idx;
alter index if exists sync_events_repo_id_idx rename to sync_events_library_id_idx;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'repositories_slug_format') then
    alter table libraries rename constraint repositories_slug_format to libraries_slug_format;
  end if;
  if exists (select 1 from pg_constraint where conname = 'repository_members_email_lower') then
    alter table library_members rename constraint repository_members_email_lower to library_members_email_lower;
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- libraries — 문서 서가. 여러 GitHub 레포가 하나를 공유한다
-- ─────────────────────────────────────────────────────────────
create table if not exists libraries (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,    -- URL이자 MCP `library` 인자
  name                    text not null,           -- 사람이 읽는 이름. 중복 허용
  -- 이 서가를 보는 GitHub 레포들. 'org/repo' 또는 조직 전체를 뜻하는 'org/*'.
  -- 단수 컬럼이었을 때는 조직이 서가 하나를 공유하면 하나를 임의로 골라야 했다.
  github_repos            text[] not null default '{}',
  -- 알림 채널. 둘 다 둘 수 있다 — 페이로드 키가 다르다(Mattermost {text}, Discord {content}).
  mattermost_webhook_url  text,
  discord_webhook_url     text,
  -- 최신 이벤트 id 비정규화 (D-012). 갱신은 lib/mirror.ts recordChange 한 곳뿐이다.
  latest_event_id         bigint not null default 0,
  -- 마지막으로 실제 발송한 시각. 알림 디바운스 창의 기준점이고, 조건부 UPDATE의 CAS 키다.
  -- null = 아직 한 번도 안 보냄 → 다음 변경이 즉시 나간다.
  last_notified_at        timestamptz,
  -- 멤버 관리·설정 변경·이력 되돌리기를 할 수 있는 단 한 사람 (D-021). 만든 사람으로 시작한다.
  -- null = 소유자 없음(마지막 멤버가 나가는 등) — 그때는 admin만 손댈 수 있다.
  owner_email             text,
  -- true면 **로그인 없이** 문서 목록·본문을 읽을 수 있다 (D-024). 소유자만 켤 수 있고,
  -- 켜도 쓰기는 여전히 멤버만이다 — 읽기 문턱만 내리는 값이지 쓰기와는 무관하다.
  -- 기본 false: 켜는 건 의식적인 행동이어야 한다(fail-closed).
  is_public               boolean not null default false,
  created_at              timestamptz not null default now(),

  constraint libraries_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
  constraint libraries_owner_email_lower check (owner_email is null or owner_email = lower(owner_email))
);

-- ─────────────────────────────────────────────────────────────
-- library_members — 접근 허용 목록 + 권한
-- 행이 0개인 이메일 = 로그인해도 아무것도 못 봄 (SPEC P3)
-- 서가를 만든 사람이 첫 행이 된다 (D-013)
-- ─────────────────────────────────────────────────────────────
create table if not exists library_members (
  library_id  uuid not null references libraries(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now(),

  primary key (library_id, email),
  -- 대소문자 차이가 곧 ACL 우회 구멍이다. DB에서도 막는다.
  constraint library_members_email_lower check (email = lower(email))
);

create index if not exists library_members_email_idx on library_members (email);

-- ─────────────────────────────────────────────────────────────
-- library_invites — 소유자가 만드는 초대 링크 (D-023).
-- access_tokens와 같은 원칙으로 sha256 해시만 저장하고 발급 순간 1회만 노출한다 —
-- 다시 보여줘야 하는 값이 아니라, PAT처럼 "잃어버리면 재발급"이 맞다. 재발급 = 새 값 +
-- 기존 revoked_at 설정이라 라이브러리당 살아있는 링크는 항상 최대 하나다(app 로직에서 보장).
-- ─────────────────────────────────────────────────────────────
create table if not exists library_invites (
  id           uuid primary key default gen_random_uuid(),
  library_id   uuid not null references libraries(id) on delete cascade,
  token_hash   text not null unique,             -- sha256(cshn_inv_...). 평문 저장 금지
  created_by   text not null,                    -- lowercase
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,

  constraint library_invites_created_by_lower check (created_by = lower(created_by))
);

-- 유효 초대만 훑는 경로. 폐기된 링크는 인덱스에서 빠진다 (access_tokens_active_idx와 같은 모양)
create index if not exists library_invites_active_idx
  on library_invites (token_hash) where revoked_at is null;

create index if not exists library_invites_library_idx on library_invites (library_id);

-- ─────────────────────────────────────────────────────────────
-- users — 로그인한 적 있는 모든 사용자
-- NextAuth signIn 콜백에서 upsert된다. library_members·access_tokens와 무관하게
-- "로그인만 한 사람"도 관리자 화면에 나오게 하려고 도입했다.
-- ─────────────────────────────────────────────────────────────
create table if not exists users (
  email       text primary key,
  created_at  timestamptz not null default now(),

  constraint users_email_lower check (email = lower(email))
);

alter table users enable row level security;

-- ─────────────────────────────────────────────────────────────
-- documents — 문서 **원본** (D-011). 되돌릴 git이 없다.
-- ─────────────────────────────────────────────────────────────
create table if not exists documents (
  id           uuid primary key default gen_random_uuid(),
  library_id   uuid not null references libraries(id) on delete cascade,
  path         text not null,                    -- 서가 루트 기준 ('SPEC.md', 'adr/0001-x.md')
  title        text,                             -- 첫 '# ' 헤딩. 없으면 null
  content      text not null,
  content_sha  text not null,                    -- 읽기 ETag이자 쓰기 CAS 키
  updated_by   text,                             -- git의 author를 대신한다
  updated_at   timestamptz not null default now(),

  unique (library_id, path)
);

-- ─────────────────────────────────────────────────────────────
-- document_versions — 이력. "되돌리기"의 유일한 근거다. append-only.
--
-- documents(id)를 참조하지 **않는다**. 참조하면 문서를 지울 때 이력이 같이 사라지는데,
-- 삭제야말로 되돌릴 수 있어야 하는 사건이다. 안정적인 키인 (서가, 경로)에 매단다 —
-- 같은 경로에 다시 만들면 이력이 이어지는 것도 이 편이 맞다.
-- ─────────────────────────────────────────────────────────────
create table if not exists document_versions (
  id           bigserial primary key,
  library_id   uuid not null references libraries(id) on delete cascade,
  path         text not null,
  content      text not null,
  content_sha  text not null,
  author       text not null,
  note         text,                              -- 편집 메모. 커밋 메시지 자리
  created_at   timestamptz not null default now(),

  constraint document_versions_author_lower check (author = lower(author))
);

create index if not exists document_versions_path_idx
  on document_versions (library_id, path, id desc);

-- ─────────────────────────────────────────────────────────────
-- sync_events — 델타 피드 + 알림 원본
-- ─────────────────────────────────────────────────────────────
create table if not exists sync_events (
  id             bigserial primary key,
  library_id     uuid not null references libraries(id) on delete cascade,
  author         text,
  changed_paths  text[] not null default '{}',
  deleted_paths  text[] not null default '{}',
  summary        text,                             -- 구조적 요약 (SPEC §8). LLM 아님
  -- 이 이벤트가 알림에 실려 나간 시각. null = 아직 안 보냄 (디바운스 대기 중).
  -- 델타 피드(doc_changes_since)는 이 값을 보지 않는다 — 커서는 token_cursors가 따로 센다.
  notified_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists sync_events_library_id_idx on sync_events (library_id, id desc);

-- notified_at을 쓰는 부분 인덱스는 여기 두면 안 된다 — 이미 있는 DB에서는 위 create table이
-- 통째로 건너뛰어져 그 컬럼이 아직 없다. 아래 [수렴] 절의 add column 뒤에 있다.

-- ─────────────────────────────────────────────────────────────
-- access_tokens — 에이전트용. 사람 단위이고 서가에 속하지 않는다
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
  library_id     uuid not null references libraries(id) on delete cascade,
  last_event_id  bigint not null default 0,
  updated_at     timestamptz not null default now(),

  primary key (token_id, library_id)
);

-- ─────────────────────────────────────────────────────────────
-- usage_hourly — MCP 툴 **호출 수** 집계. /admin의 요청 수가 이걸 읽는다 (D-020)
--
-- "얼마나 불렀나"는 실제 호출을 기록해야만 안다. access_tokens.last_used_at은 5분
-- 스로틀이라 횟수 집계에 못 쓴다.
--
-- **호출별 원본을 쌓지 않는다.** 그러면 "누가 언제 어느 문서를 읽었는지"가 남는데 그건 이
-- 시스템이 갖고 있지 않은 정보다. (날짜 × 시각 × 라이브러리 × 툴) 집계로 화면에 필요한 건
-- 다 나온다.
--
-- 토큰 양(in_chars·out_chars)은 걷어냈다. 그 값을 읽던 라이브러리 화면의 토큰 그래프가
-- 없어져서, 아무도 읽지 않는 컬럼에 매 호출 쓰기만 하고 있었다. 아래 [정리] 절이 지운다.
--
-- `hour`는 남아 있지만 지금은 아무도 읽지 않는다 — /admin은 날짜로만 접는다. 시각축을
-- 쓰는 화면이 다시 생기지 않으면 primary key와 함께 접을 수 있다.
--
-- 날짜·시각은 UTC다. 타임존을 박으면 남이 자기 인스턴스를 띄웠을 때 틀린다.
-- ─────────────────────────────────────────────────────────────
create table if not exists usage_hourly (
  day        date not null default current_date,
  hour       smallint not null default 0,
  -- NOT NULL이다. 라이브러리에 귀속되지 않는 호출(library 인자 없는 doc_outline,
  -- library_create)은 애초에 기록하지 않는다. 그만큼 과소집계되고, 화면이 그 사실을 밝힌다.
  library_id uuid not null references libraries(id) on delete cascade,
  tool       text not null,
  calls      integer not null default 0,

  constraint usage_hourly_hour_range check (hour between 0 and 23),
  primary key (day, hour, library_id, tool)
);

create index if not exists usage_hourly_library_day_idx on usage_hourly (library_id, day desc);

-- 원자적 누적.
-- **supabase-js의 .upsert()로는 표현할 수 없다.** `calls = calls + 1`처럼 기존 값을 읽어
-- 더해야 하는데, JS에서 select→update로 나누면 연달아 오는 툴 호출이 서로를 덮어 카운트가
-- 유실된다. 단일 INSERT ... ON CONFLICT DO UPDATE는 한 문장이라 원자적이다.
--
-- 인자가 4개에서 2개로 줄었다. `create or replace`는 **시그니처가 다르면 교체가 아니라
-- 오버로드 추가**라서, 구 버전을 명시적으로 지워야 한다. 안 지우면 in_chars를 쓰는 함수가
-- 살아남아 지워진 컬럼을 참조하다 호출 시점에 터진다.
drop function if exists record_usage(uuid, text, integer, integer);

create or replace function record_usage(
  p_library uuid,
  p_tool    text
) returns void
language sql
as $$
  insert into usage_hourly (day, hour, library_id, tool, calls)
  values (
    (now() at time zone 'utc')::date,
    extract(hour from now() at time zone 'utc')::smallint,
    p_library, p_tool, 1
  )
  on conflict (day, hour, library_id, tool) do update
    set calls = usage_hourly.calls + 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- request_logs — MCP 요청 로그. /admin 모니터링이 읽는다 (D-020)
--
-- usage_hourly(집계)로는 "무엇이 실패하나"를 답할 수 없어 요청 단위로 남긴다.
-- 에러를 따로 수집하지 않는다 — status 4xx/5xx 필터가 그 자리다.
-- library는 FK가 아니라 요청이 보낸 slug 그대로다 — 오타로 인한 404도 그대로 보여야 한다.
-- ponytail: 보존 무제한. 행이 무거워지면 보존 기간·정리 배치를 붙인다 (D-020 재검토 조건)
-- ─────────────────────────────────────────────────────────────
create table if not exists request_logs (
  id           bigserial primary key,
  method       text,                   -- JSON-RPC 메서드. 인증 실패·파싱 실패면 null
  tool         text,                   -- tools/call일 때 툴 이름
  library      text,                   -- 요청이 보낸 slug 그대로. 검증 전 값이다
  actor        text,                   -- 토큰의 이메일. 인증 실패면 null
  status       smallint not null,      -- HTTP 의미의 상태 (200·202·400·401·404·409·500)
  error        text,                   -- 실패 메시지. 성공이면 null
  duration_ms  integer not null default 0,
  created_at   timestamptz not null default now()
);

-- 조회 경로는 "상태(범위)로 걸러 최신순" 하나뿐이다
create index if not exists request_logs_status_idx on request_logs (status, id desc);

-- ─────────────────────────────────────────────────────────────
-- 이미 만들어진 DB 수렴
-- 위 create table은 테이블이 있으면 통째로 건너뛴다 — 나중에 생긴 컬럼은 여기서 채운다.
-- ─────────────────────────────────────────────────────────────
alter table libraries add column if not exists discord_webhook_url text;
alter table libraries add column if not exists latest_event_id bigint not null default 0;
alter table libraries add column if not exists github_repos text[] not null default '{}';
alter table libraries add column if not exists last_notified_at timestamptz;
alter table libraries add column if not exists owner_email text;
alter table libraries add column if not exists is_public boolean not null default false;
alter table libraries drop constraint if exists libraries_owner_email_lower;
alter table libraries add constraint libraries_owner_email_lower
  check (owner_email is null or owner_email = lower(owner_email));

-- 소유자 백필 (D-021). "만든 사람"을 저장해 두지 않았으니 최선의 근사치로 그 레포에서
-- 가장 먼저 합류한 멤버를 쓴다 — D-013의 "만든 사람이 첫 멤버가 된다"와 같은 가정이다.
-- 멤버가 하나도 없는 레포는 owner_email이 null로 남고, admin만 손댈 수 있다.
update libraries l
   set owner_email = (
     select m.email from library_members m
      where m.library_id = l.id
      order by m.created_at
      limit 1
   )
 where l.owner_email is null;

alter table documents add column if not exists updated_by text;
alter table sync_events add column if not exists notified_at timestamptz;

-- 발송 대기분만 훑는 부분 인덱스. 보낸 이벤트는 계속 쌓이지만 이 인덱스는 안 커진다.
-- 컬럼을 참조하므로 반드시 위 add column 뒤다.
create index if not exists sync_events_pending_idx
  on sync_events (library_id, id) where notified_at is null;

-- 이미 있던 이벤트는 발송된 것으로 친다. 안 그러면 배포 후 첫 쓰기가 과거 전부를
-- 한 통에 묶어 쏜다. '1시간 이전'으로 제한하는 건 이 파일을 다시 돌려도 그 사이
-- 대기 중인 알림을 삼키지 않게 하려는 것이다.
update sync_events
   set notified_at = created_at
 where notified_at is null
   and created_at < now() - interval '1 hour';

alter table documents drop constraint if exists documents_updated_by_lower;
alter table documents add constraint documents_updated_by_lower
  check (updated_by is null or updated_by = lower(updated_by));

-- 단수 github_full_name → 배열. 값을 옮긴 뒤에 지운다.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'libraries' and column_name = 'github_full_name')
  then
    update libraries
       set github_repos = array[github_full_name]
     where github_full_name is not null and github_repos = '{}';
    alter table libraries drop column github_full_name;
  end if;
end $$;

-- latest_event_id 백필. 이미 채워져 있으면 같은 값으로 덮으므로 여러 번 돌려도 같다.
update libraries l
set latest_event_id = coalesce((select max(id) from sync_events e where e.library_id = l.id), 0);

-- ─────────────────────────────────────────────────────────────
-- [정리] 죽은 컬럼 — 되돌릴 수 없다
-- 읽는 코드가 0건임을 확인하고 지운다. git 동기화를 들어낸 D-011의 잔재다.
-- ─────────────────────────────────────────────────────────────
alter table documents   drop column if exists commit_sha;        -- 가리킬 커밋이 없다
alter table libraries   drop column if exists sync_token_hash;   -- 레포가 미는 경로가 없다
alter table sync_events drop column if exists commit_sha;
alter table sync_events drop column if exists message;           -- note와 summary에 이미 있다

-- 토큰 양. 라이브러리 화면의 토큰 그래프를 걷어내면서 읽는 코드가 0건이 됐다.
-- 위 record_usage가 이미 2인자 버전으로 바뀌었으므로 쓰는 쪽도 없다.
alter table usage_hourly drop column if exists in_chars;
alter table usage_hourly drop column if exists out_chars;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- 이 앱은 service_role 키로만 DB에 접근하며 service_role은 RLS를 우회한다.
-- 그래도 RLS를 켜 두는 이유: anon/authenticated 키가 어떤 경로로든 노출됐을 때
-- 정책이 하나도 없는 테이블은 전부 거부되기 때문이다. fail-closed 기본값.
-- 권한 검사의 실체는 애플리케이션 코드에 있다 (SPEC §6).
-- ─────────────────────────────────────────────────────────────
alter table libraries          enable row level security;
alter table library_members    enable row level security;
alter table documents          enable row level security;
alter table document_versions  enable row level security;
alter table sync_events        enable row level security;
alter table access_tokens      enable row level security;
alter table token_cursors      enable row level security;
alter table usage_hourly       enable row level security;
alter table request_logs       enable row level security;
alter table library_invites    enable row level security;
