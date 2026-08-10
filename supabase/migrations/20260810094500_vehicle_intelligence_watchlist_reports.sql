-- BIISMO vehicle intelligence support: watchlist monitoring and time-limited shared reports.
-- Applied to production through Supabase MCP on 2026-08-10.

create table if not exists private.vehicle_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  registration text not null,
  make text,
  model text,
  tax_status text,
  tax_due_date date,
  mot_status text,
  mot_expiry_date date,
  last_mileage integer,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, registration)
);
alter table private.vehicle_watchlist enable row level security;
create index if not exists vehicle_watchlist_user_id_idx on private.vehicle_watchlist(user_id);
create index if not exists vehicle_watchlist_due_refresh_idx on private.vehicle_watchlist(last_checked_at nulls first, created_at);

create table if not exists private.shared_vehicle_reports (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  registration text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
alter table private.shared_vehicle_reports enable row level security;
create index if not exists shared_vehicle_reports_user_created_idx on private.shared_vehicle_reports(user_id, created_at desc);
create index if not exists shared_vehicle_reports_expires_idx on private.shared_vehicle_reports(expires_at);

-- The production functions created with this migration are:
-- public.upsert_vehicle_watch(...)
-- public.get_vehicle_watchlist()
-- public.remove_vehicle_watch(uuid)
-- public.create_shared_vehicle_report(jsonb)
-- public.get_shared_vehicle_report(text)
-- public.get_due_watch_refreshes(text)
-- public.record_watch_refresh(...)
-- They are deliberately SECURITY DEFINER with explicit auth.uid() or secret checks,
-- and the underlying tables remain in the non-exposed private schema.
