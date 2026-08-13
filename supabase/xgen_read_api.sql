-- Xgen public read API for six-digit-thai-lao.
-- The browser receives only active market names and at most 30 recent results.

create schema if not exists xgen_private;
revoke all on schema xgen_private from public;
grant usage on schema xgen_private to anon, authenticated;

create or replace function xgen_private.list_markets()
returns table (
  market_key text,
  market_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.market_key, m.market_name
  from public.veltrix_markets as m
  where m.active = true
    and exists (
      select 1
      from public.veltrix_market_results as r
      where r.market_id = m.id
    )
  order by m.market_name;
$$;

create or replace function xgen_private.recent_results(
  p_market_key text,
  p_limit integer default 4
)
returns table (
  draw_date date,
  top3 text,
  bottom2 text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.draw_date, r.top3, r.bottom2
  from public.veltrix_market_results as r
  join public.veltrix_markets as m on m.id = r.market_id
  where m.active = true
    and m.market_key = p_market_key
    and p_market_key ~ '^market_[0-9]{3}$'
  order by r.draw_date desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 4), 1), 30);
$$;

revoke all on function xgen_private.list_markets() from public;
revoke all on function xgen_private.recent_results(text, integer) from public;
grant execute on function xgen_private.list_markets() to anon, authenticated;
grant execute on function xgen_private.recent_results(text, integer) to anon, authenticated;

create or replace function public.xgen_list_markets()
returns table (
  market_key text,
  market_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from xgen_private.list_markets();
$$;

create or replace function public.xgen_recent_results(
  p_market_key text,
  p_limit integer default 4
)
returns table (
  draw_date date,
  top3 text,
  bottom2 text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from xgen_private.recent_results(p_market_key, p_limit);
$$;

revoke all on function public.xgen_list_markets() from public;
revoke all on function public.xgen_recent_results(text, integer) from public;
grant execute on function public.xgen_list_markets() to anon, authenticated;
grant execute on function public.xgen_recent_results(text, integer) to anon, authenticated;

comment on function public.xgen_list_markets() is
  'Read-only market list for Xgen. No result mutation capability.';
comment on function public.xgen_recent_results(text, integer) is
  'Read-only Xgen history endpoint capped at 30 rows per active market.';
