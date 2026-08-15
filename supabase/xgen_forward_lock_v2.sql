-- Xgen Forward Lock V2
-- Keeps an Xgen-owned archive, locks one forward snapshot per current market,
-- settles it only when a chronologically newer result arrives, and never exposes writes to the browser.

create table if not exists public.xgen_market_result_archive (
  id uuid primary key default gen_random_uuid(),
  origin_result_id uuid not null unique,
  market_id uuid not null references public.veltrix_markets(id) on delete cascade,
  draw_date date not null,
  top3 text not null check (top3 ~ '^[0-9]{3}$'),
  bottom2 text not null check (bottom2 ~ '^[0-9]{2}$'),
  source text not null default 'veltrix_market_results',
  recorded_at timestamptz not null,
  archived_at timestamptz not null default now()
);

comment on table public.xgen_market_result_archive is
  'Xgen-owned append-preserving result archive. Decouples Xgen 30+ draw windows from Veltrix 20-row pruning.';

create index if not exists xgen_market_result_archive_market_date_idx
  on public.xgen_market_result_archive (market_id, draw_date desc, recorded_at desc);

alter table public.xgen_market_result_archive enable row level security;
revoke all on table public.xgen_market_result_archive from anon, authenticated;
grant select, insert, update, delete on table public.xgen_market_result_archive to service_role;

-- Seed every result that still exists in the shared Veltrix rolling store.
insert into public.xgen_market_result_archive (
  origin_result_id, market_id, draw_date, top3, bottom2, source, recorded_at
)
select r.id, r.market_id, r.draw_date, r.top3, r.bottom2, r.source, r.created_at
from public.veltrix_market_results r
on conflict (origin_result_id) do update set
  market_id = excluded.market_id,
  draw_date = excluded.draw_date,
  top3 = excluded.top3,
  bottom2 = excluded.bottom2,
  source = excluded.source,
  recorded_at = excluded.recorded_at;

-- Preserve forward evidence even after the shared rolling table prunes old rows.
alter table public.xgen_intelligence_snapshots
  add column if not exists source_draw_date date,
  add column if not exists source_top3 text,
  add column if not exists source_bottom2 text;

alter table public.xgen_intelligence_settlements
  add column if not exists actual_draw_date date,
  add column if not exists actual_top3 text,
  add column if not exists actual_bottom2 text;

alter table public.xgen_intelligence_snapshots
  alter column source_result_id drop not null;

alter table public.xgen_intelligence_settlements
  alter column actual_result_id drop not null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'xgen_intelligence_snapshots_source_result_id_fkey'
      and conrelid = 'public.xgen_intelligence_snapshots'::regclass
  ) then
    alter table public.xgen_intelligence_snapshots
      drop constraint xgen_intelligence_snapshots_source_result_id_fkey;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'xgen_intelligence_settlements_actual_result_id_fkey'
      and conrelid = 'public.xgen_intelligence_settlements'::regclass
  ) then
    alter table public.xgen_intelligence_settlements
      drop constraint xgen_intelligence_settlements_actual_result_id_fkey;
  end if;
end $$;

alter table public.xgen_intelligence_snapshots
  add constraint xgen_intelligence_snapshots_source_result_id_fkey
  foreign key (source_result_id)
  references public.veltrix_market_results(id)
  on delete set null;

alter table public.xgen_intelligence_settlements
  add constraint xgen_intelligence_settlements_actual_result_id_fkey
  foreign key (actual_result_id)
  references public.veltrix_market_results(id)
  on delete set null;

create index if not exists xgen_intelligence_snapshots_market_source_date_idx
  on public.xgen_intelligence_snapshots (market_id, source_draw_date desc, locked_at desc);

create or replace function public.xgen_forward_lock_on_result()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_snapshot_id uuid;
  v_latest_origin uuid;
  v_history jsonb;
begin
  -- First, preserve every insert/update in Xgen's own archive.
  insert into public.xgen_market_result_archive (
    origin_result_id, market_id, draw_date, top3, bottom2, source, recorded_at, archived_at
  ) values (
    new.id, new.market_id, new.draw_date, new.top3, new.bottom2, new.source, new.created_at, now()
  )
  on conflict (origin_result_id) do update set
    market_id = excluded.market_id,
    draw_date = excluded.draw_date,
    top3 = excluded.top3,
    bottom2 = excluded.bottom2,
    source = excluded.source,
    recorded_at = excluded.recorded_at,
    archived_at = now();

  -- Corrections update the archive, but must never rewrite a previously locked prediction.
  if tg_op = 'UPDATE' then
    return new;
  end if;

  -- Settle only an already-locked, chronologically previous open snapshot.
  select s.id
    into v_snapshot_id
  from public.xgen_intelligence_snapshots s
  left join public.xgen_intelligence_settlements st on st.snapshot_id = s.id
  where s.market_id = new.market_id
    and st.id is null
    and s.source_draw_date is not null
    and s.source_draw_date < new.draw_date
    and s.locked_at <= now()
  order by s.source_draw_date desc, s.locked_at desc
  limit 1;

  if v_snapshot_id is not null then
    insert into public.xgen_intelligence_settlements (
      snapshot_id,
      actual_result_id,
      actual_draw_date,
      actual_top3,
      actual_bottom2,
      metrics
    ) values (
      v_snapshot_id,
      new.id,
      new.draw_date,
      new.top3,
      new.bottom2,
      jsonb_build_object(
        'forward_only', true,
        'actual', jsonb_build_object(
          'draw_date', new.draw_date,
          'top3', new.top3,
          'bottom2', new.bottom2
        ),
        'settlement_engine', 'xgen_forward_lock_v2'
      )
    )
    on conflict (snapshot_id) do nothing;
  end if;

  -- Only the chronologically newest result becomes the next forward source.
  select a.origin_result_id
    into v_latest_origin
  from public.xgen_market_result_archive a
  where a.market_id = new.market_id
  order by a.draw_date desc, a.recorded_at desc, a.origin_result_id desc
  limit 1;

  if v_latest_origin is distinct from new.id then
    return new;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'origin_result_id', h.origin_result_id,
        'draw_date', h.draw_date,
        'top3', h.top3,
        'bottom2', h.bottom2
      ) order by h.draw_date desc, h.recorded_at desc, h.origin_result_id desc
    ),
    '[]'::jsonb
  )
  into v_history
  from (
    select a.origin_result_id, a.draw_date, a.top3, a.bottom2, a.recorded_at
    from public.xgen_market_result_archive a
    where a.market_id = new.market_id
      and a.draw_date <= new.draw_date
    order by a.draw_date desc, a.recorded_at desc, a.origin_result_id desc
    limit 30
  ) h;

  insert into public.xgen_intelligence_snapshots (
    market_id,
    source_result_id,
    source_draw_date,
    source_top3,
    source_bottom2,
    engine_version,
    mode,
    payload,
    locked_at
  ) values (
    new.market_id,
    new.id,
    new.draw_date,
    new.top3,
    new.bottom2,
    'market_intelligence_v2_shadow',
    'shadow',
    jsonb_build_object(
      'forward_only', true,
      'engine_version', 'market_intelligence_v2_shadow',
      'history_limit', 30,
      'history', v_history,
      'source', jsonb_build_object(
        'origin_result_id', new.id,
        'draw_date', new.draw_date,
        'top3', new.top3,
        'bottom2', new.bottom2
      )
    ),
    now()
  )
  on conflict (market_id, source_result_id, engine_version) do nothing;

  return new;
end;
$$;

revoke all on function public.xgen_forward_lock_on_result() from public, anon, authenticated;

drop trigger if exists trg_xgen_forward_lock on public.veltrix_market_results;
create trigger trg_xgen_forward_lock
after insert or update of draw_date, top3, bottom2, source
on public.veltrix_market_results
for each row
execute function public.xgen_forward_lock_on_result();

-- Xgen now reads its own archive; the public API shape remains unchanged.
create or replace function xgen_private.recent_results(
  p_market_key text,
  p_limit integer default 4
)
returns table(draw_date date, top3 text, bottom2 text)
language sql
stable
security definer
set search_path to ''
as $$
  select a.draw_date, a.top3, a.bottom2
  from public.xgen_market_result_archive as a
  join public.veltrix_markets as m on m.id = a.market_id
  where m.active = true
    and m.market_key = p_market_key
    and p_market_key ~ '^market_[0-9]{3}$'
  order by a.draw_date desc, a.recorded_at desc, a.origin_result_id desc
  limit least(greatest(coalesce(p_limit, 4), 1), 30);
$$;

-- Lock one clean forward starting point for every market that currently has data.
with latest as (
  select distinct on (a.market_id)
    a.market_id,
    a.origin_result_id,
    a.draw_date,
    a.top3,
    a.bottom2,
    a.recorded_at
  from public.xgen_market_result_archive a
  order by a.market_id, a.draw_date desc, a.recorded_at desc, a.origin_result_id desc
), prepared as (
  select
    l.*,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'origin_result_id', h.origin_result_id,
            'draw_date', h.draw_date,
            'top3', h.top3,
            'bottom2', h.bottom2
          ) order by h.draw_date desc, h.recorded_at desc, h.origin_result_id desc
        ),
        '[]'::jsonb
      )
      from (
        select a2.origin_result_id, a2.draw_date, a2.top3, a2.bottom2, a2.recorded_at
        from public.xgen_market_result_archive a2
        where a2.market_id = l.market_id
          and a2.draw_date <= l.draw_date
        order by a2.draw_date desc, a2.recorded_at desc, a2.origin_result_id desc
        limit 30
      ) h
    ) as history
  from latest l
)
insert into public.xgen_intelligence_snapshots (
  market_id,
  source_result_id,
  source_draw_date,
  source_top3,
  source_bottom2,
  engine_version,
  mode,
  payload,
  locked_at
)
select
  p.market_id,
  p.origin_result_id,
  p.draw_date,
  p.top3,
  p.bottom2,
  'market_intelligence_v2_shadow',
  'shadow',
  jsonb_build_object(
    'forward_only', true,
    'engine_version', 'market_intelligence_v2_shadow',
    'history_limit', 30,
    'history', p.history,
    'source', jsonb_build_object(
      'origin_result_id', p.origin_result_id,
      'draw_date', p.draw_date,
      'top3', p.top3,
      'bottom2', p.bottom2
    )
  ),
  now()
from prepared p
on conflict (market_id, source_result_id, engine_version) do nothing;

-- Initialize the four shadow experts per market. Live samples remain zero until real forward settlements exist.
insert into public.xgen_expert_profiles (market_id, expert_key, live_samples, live_score, adaptive_weight, evidence)
select m.id, e.expert_key, 0, 0, 25, jsonb_build_object('mode', 'shadow', 'forward_only', true)
from public.veltrix_markets m
cross join (values ('momentum'), ('transition'), ('frequency'), ('pattern')) as e(expert_key)
where m.active = true
  and exists (select 1 from public.xgen_market_result_archive a where a.market_id = m.id)
on conflict (market_id, expert_key) do nothing;
