-- 레포별 최신 이벤트 id를 비정규화한다 (D-012).
-- 실행: Supabase Dashboard > SQL Editor. 추가만 하므로 지금 실행해도 옛 코드를 깨뜨리지 않는다.
--
-- 왜: MCP는 매 툴 호출마다 "밀렸나"를 판단해야 한다(D-005의 [stale] 한 줄).
-- 지금은 그 판단을 위해 레포마다 sync_events를 한 번씩 두드린다 — 호출당 N 왕복.
-- 최신 이벤트 id를 레포 행에 얹으면 어차피 하는 레포 조회에 공짜로 실려 온다.
-- 갱신은 쓰기 경로(lib/mirror.ts recordChange) 한 곳뿐이라 어긋날 자리가 없다.

alter table repositories add column if not exists latest_event_id bigint not null default 0;

-- 기존 이벤트 백필
update repositories r
set latest_event_id = coalesce(
  (select max(id) from sync_events e where e.repository_id = r.id),
  0
);
