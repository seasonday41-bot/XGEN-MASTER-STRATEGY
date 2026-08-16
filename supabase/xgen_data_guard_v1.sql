-- Xgen Data Guard V1
-- Database-side invariant: one archived result per market/date.
-- Source Veltrix already enforces the same invariant; this keeps Xgen Archive equally strict.

alter table public.xgen_market_result_archive
  add constraint xgen_market_result_archive_market_date_unique
  unique (market_id, draw_date);

comment on constraint xgen_market_result_archive_market_date_unique
  on public.xgen_market_result_archive is
  'Data Guard: prevents duplicate draw dates inside the same Xgen market archive.';
