-- 0002_usage.sql — MCP 툴 사용량 시간 단위 집계
--
-- 왜 필요한가: `documents` 본문에서 계산하는 예측 절약에는 시간축이 없다. "오늘 얼마나
-- 읽었나"는 실제 호출을 기록해야만 안다. `access_tokens.last_used_at`은 5분 스로틀이
-- 걸려 있어 횟수 집계에도 못 쓴다.
--
-- **시간 단위로 접어서 저장한다.** 호출별 원본을 쌓으면 "누가 언제 어느 문서를 읽었는지"가
-- 그대로 남는데, 그건 지금 이 시스템이 갖고 있지 않은 정보다. 화면에 필요한 건
-- (날짜 × 시각 × 라이브러리 × 툴) 집계로 전부 나온다 — 오늘 화면은 시각을 그대로 축에
-- 쓰고, 7일·30일 화면은 시각을 날짜로 합친다. 거친 쪽은 세밀한 쪽에서 만들 수 있지만
-- 반대는 안 되므로 시간이 저장 단위다.
--
-- 행 수: 라이브러리 하나당 24시간 × 툴 5종 × 30일 ≈ 3,600행/월. 감당된다.
--
-- 날짜·시각 경계는 **UTC**다. 한국에서는 오전 9시에 "오늘"이 바뀐다 — 화면에 UTC 기준임을
-- 표기한다. 타임존을 박으면 다른 사람이 자기 인스턴스를 띄웠을 때 틀린다.

create table if not exists usage_hourly (
  day        date not null default current_date,
  hour       smallint not null default 0,
  -- NOT NULL이다. primary key가 NULL을 허용하지 않기도 하지만, 그보다 라이브러리에
  -- 붙일 수 없는 호출(library 인자 없는 doc_outline, library_create)은 **애초에 기록하지
  -- 않기** 때문이다. 소비자가 라이브러리 화면 하나뿐이라 귀속 못 하는 호출은 어차피
  -- 어느 차트에도 안 나온다. 그만큼 과소집계된다는 걸 화면에 적는다.
  library_id uuid not null references libraries(id) on delete cascade,
  tool       text not null,
  calls      integer not null default 0,
  -- 에이전트가 보낸 것(doc_put content 등). 모델 관점에서는 출력 토큰이었다.
  in_chars   bigint not null default 0,
  -- 에이전트가 받은 것(툴 응답). 모델 관점에서는 입력 토큰이 된다.
  out_chars  bigint not null default 0,

  constraint usage_hourly_hour_range check (hour between 0 and 23),
  primary key (day, hour, library_id, tool)
);

-- 기간 조회가 매번 날짜 범위로 훑는다.
create index if not exists usage_hourly_library_day_idx on usage_hourly (library_id, day desc);

-- 다른 테이블과 같은 fail-closed 자세: RLS는 켜고 정책은 두지 않는다.
-- 실제 접근 판정은 애플리케이션이 한다(service_role로 붙으므로 RLS를 우회한다).
alter table usage_hourly enable row level security;

-- 원자적 누적.
--
-- **supabase-js의 .upsert()로는 이걸 표현할 수 없다.** `calls = calls + 1`처럼 기존 값을
-- 읽어 더해야 하는데, JS에서 select→update로 나누면 동시 호출이 서로를 덮어 카운트가
-- 유실된다. 에이전트는 툴을 연달아 부르므로 그 경합이 실제로 일어난다.
-- 단일 INSERT ... ON CONFLICT DO UPDATE는 한 문장이라 원자적이다.
create or replace function record_usage(
  p_library uuid,
  p_tool    text,
  p_in      integer,
  p_out     integer
) returns void
language sql
as $$
  insert into usage_hourly (day, hour, library_id, tool, calls, in_chars, out_chars)
  values (
    (now() at time zone 'utc')::date,
    extract(hour from now() at time zone 'utc')::smallint,
    p_library, p_tool, 1, greatest(p_in, 0), greatest(p_out, 0)
  )
  on conflict (day, hour, library_id, tool) do update
    set calls     = usage_hourly.calls + 1,
        in_chars  = usage_hourly.in_chars + excluded.in_chars,
        out_chars = usage_hourly.out_chars + excluded.out_chars;
$$;
