-- Run this file in the Supabase SQL editor after creating the project.

create table if not exists public.saved_vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  registration text not null check (registration ~ '^[A-Z0-9]{2,8}$'),
  make text,
  model text,
  colour text,
  tax_status text,
  tax_due_date date,
  mot_status text,
  mot_expiry_date date,
  last_mileage integer,
  saved_at timestamptz not null default now(),
  unique (user_id, registration)
);

alter table public.saved_vehicles enable row level security;

-- New Supabase projects do not automatically expose public tables to the
-- Data API. Grant only the operations used by signed-in garage users.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.saved_vehicles to authenticated;
revoke all on table public.saved_vehicles from anon;

drop policy if exists "Users can view their own saved vehicles" on public.saved_vehicles;
create policy "Users can view their own saved vehicles"
on public.saved_vehicles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can save their own vehicles" on public.saved_vehicles;
create policy "Users can save their own vehicles"
on public.saved_vehicles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own saved vehicles" on public.saved_vehicles;
create policy "Users can update their own saved vehicles"
on public.saved_vehicles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own saved vehicles" on public.saved_vehicles;
create policy "Users can remove their own saved vehicles"
on public.saved_vehicles for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists saved_vehicles_user_saved_at_idx
on public.saved_vehicles (user_id, saved_at desc);
