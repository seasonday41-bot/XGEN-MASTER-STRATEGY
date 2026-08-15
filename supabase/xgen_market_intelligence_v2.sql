-- Xgen Market Intelligence V2 (Shadow)
-- Forward-only storage layer. Customer UI remains read-only.

create table if not exists public.xgen_intelligence_snapshots (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.veltrix_markets(id) on delete cascade,
  source_result_id uuid not null references public.veltrix_market_results(id) on delete cascade,
  engine_version text not null default 'market_intelligence_v2_shadow',
  mode text not null default 'shadow' check (mode in ('shadow', 'production')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  locked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (market_id, source_result_id, engine_version)
);

comment on table public.xgen_intelligence_snapshots is
  'Immutable-style Xgen Market Intelligence snapshots. Writes are server-side only; customer browser has no insert/update/delete grant.';

create index if not exists xgen_intelligence_snapshots_market_locked_idx
  on public.xgen_intelligence_snapshots (market_id, locked_at desc);

alter table public.xgen_intelligence_snapshots enable row level security;
revoke all on table public.xgen_intelligence_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.xgen_intelligence_snapshots to service_role;

create table if not exists public.xgen_intelligence_settlements (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null unique references public.xgen_intelligence_snapshots(id) on delete cascade,
  actual_result_id uuid not null references public.veltrix_market_results(id) on delete cascade,
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  settled_at timestamptz not null default now()
);

comment on table public.xgen_intelligence_settlements is
  'Forward settlement for Xgen Market Intelligence snapshots. One settlement per locked snapshot.';

create index if not exists xgen_intelligence_settlements_actual_idx
  on public.xgen_intelligence_settlements (actual_result_id);

alter table public.xgen_intelligence_settlements enable row level security;
revoke all on table public.xgen_intelligence_settlements from anon, authenticated;
grant select, insert, update, delete on table public.xgen_intelligence_settlements to service_role;

create table if not exists public.xgen_expert_profiles (
  market_id uuid not null references public.veltrix_markets(id) on delete cascade,
  expert_key text not null check (expert_key in ('momentum', 'transition', 'frequency', 'pattern')),
  live_samples integer not null default 0 check (live_samples >= 0),
  live_score numeric not null default 0,
  adaptive_weight numeric not null default 25 check (adaptive_weight >= 0 and adaptive_weight <= 100),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (market_id, expert_key)
);

comment on table public.xgen_expert_profiles is
  'Per-market forward Expert Memory for Xgen. Historical replay must not overwrite live evidence.';

alter table public.xgen_expert_profiles enable row level security;
revoke all on table public.xgen_expert_profiles from anon, authenticated;
grant select, insert, update, delete on table public.xgen_expert_profiles to service_role;
