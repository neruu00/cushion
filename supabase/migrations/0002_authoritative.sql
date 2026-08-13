-- Cushion을 스펙의 원본으로 (D-011). git 미러에서 원본으로 뒤집는다.
-- 실행: Supabase Dashboard > SQL Editor
--
-- ⚠️ 순서가 있다. A는 지금 실행해도 돌아가는 앱을 깨뜨리지 않는다(추가만 한다).
--    B는 컬럼을 지우므로 **새 코드가 배포된 뒤에** 실행한다. 먼저 돌리면
--    아직 그 컬럼을 읽는 프로덕션이 즉시 깨진다.
--
-- 설계 근거는 SPEC.md §2, PLAN.md D-011. 요약:
--  - documents는 더 이상 캐시가 아니다. 여기가 원본이다
--  - git history가 하던 일을 document_versions가 대신한다
--  - 동시 편집은 content_sha 기반 낙관적 잠금으로 막는다 (병합하지 않는다)

-- ─────────────────────────────────────────────────────────────
-- A. 먼저 실행 — 추가만 한다
-- ─────────────────────────────────────────────────────────────

-- 누가 마지막으로 고쳤나. git의 author를 대신한다.
alter table documents add column if not exists updated_by text;

alter table documents drop constraint if exists documents_updated_by_lower;
alter table documents add constraint documents_updated_by_lower
  check (updated_by is null or updated_by = lower(updated_by));

-- 이력. 원본을 DB에 두는 순간 "되돌리기"의 유일한 근거가 된다.
-- append-only로만 쓴다. update/delete 경로를 만들지 않는다.
--
-- documents(id)를 참조하지 **않는다**. 참조하면 문서를 지울 때 이력이 같이 사라지는데,
-- 삭제야말로 되돌릴 수 있어야 하는 사건이다. 안정적인 키인 (레포, 경로)에 매단다 —
-- 같은 경로에 다시 만들면 이력이 이어지는 것도 이 편이 맞다.
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

-- RLS는 0001과 같은 이유로 켜고 정책은 두지 않는다 (fail-closed).
-- 실제 권한 검사는 애플리케이션에 있다. (SPEC §6)
alter table document_versions enable row level security;

-- ─────────────────────────────────────────────────────────────
-- B. 새 코드 배포 후 실행 — 여기부터 파괴적이다
--    실행 전에 /admin > 전체 내보내기로 문서를 받아 둘 것.
-- ─────────────────────────────────────────────────────────────

-- git 커밋이 없으므로 가리킬 대상이 없다.
-- alter table documents drop column if exists commit_sha;

-- 레포가 미는 경로가 사라졌다. sync 토큰의 주체가 없다.
-- alter table repositories drop column if exists sync_token_hash;

-- 감사에서 확인: 읽는 곳이 0건인 컬럼.
-- commit_sha는 D-011 잔재, message는 같은 내용이 document_versions.note와 summary에 있다.
-- alter table sync_events drop column if exists commit_sha;
-- alter table sync_events drop column if exists message;

-- 위 주석을 풀어서 실행한다. 되돌릴 수 없다.
