-- Xgen A/B batch reader v1
-- Read-only RPC used by the browser to build automatic forward A/B snapshots for all markets.

create or replace function xgen_private.recent_results_all(p_limit integer default 30)
returns table(
  market_key text,
  market_name text,
  draw_date date,
  top3 text,
  bottom2 text
)
language sql
stable
security definer
set search_path to ''
as $$
  with ranked as (
    select
      m.market_key,
      m.market_name,
      a.draw_date,
      a.top3,
      a.bottom2,
      row_number() over (
        partition by a.market_id
        order by a.draw_date desc, a.recorded_at desc, a.origin_result_id desc
      ) as rn
    from public.xgen_market_result_archive a
    join public.veltrix_markets m on m.id = a.market_id
    where m.active = true
      and m.market_key ~ '^market_[0-9]{3}$'
  )
  select r.market_key, r.market_name, r.draw_date, r.top3, r.bottom2
  from ranked r
  where r.rn <= least(greatest(coalesce(p_limit, 30), 4), 30)
  order by r.market_key, r.draw_date desc;
$$;

revoke all on function xgen_private.recent_results_all(integer) from public, anon, authenticated;
grant execute on function xgen_private.recent_results_all(integer) to service_role;

create or replace function public.xgen_recent_results_all(p_limit integer default 30)
returns table(
  market_key text,
  market_name text,
  draw_date date,
  top3 text,
  bottom2 text
)
language sql
stable
security definer
set search_path to ''
as $$
  select * from xgen_private.recent_results_all(p_limit);
$$;

revoke all on function public.xgen_recent_results_all(integer) from public;
grant execute on function public.xgen_recent_results_all(integer) to anon, authenticated, service_role;
