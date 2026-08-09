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

-- Search allowances and credits are kept outside the exposed Data API schema.
-- The public RPC functions below are the only client-facing entry points.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);

create table if not exists private.vehicle_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  registration text not null check (registration ~ '^[A-Z0-9]{2,8}$'),
  search_date date not null,
  credit_cost smallint not null default 0 check (credit_cost in (0, 2)),
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists private.credit_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table private.user_accounts enable row level security;
alter table private.app_admins enable row level security;
alter table private.vehicle_searches enable row level security;
alter table private.credit_transactions enable row level security;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;

create index if not exists vehicle_searches_user_date_status_idx
on private.vehicle_searches (user_id, search_date, status);

create index if not exists vehicle_searches_stale_reservations_idx
on private.vehicle_searches (created_at)
where status = 'reserved';

create index if not exists credit_transactions_granted_by_idx
on private.credit_transactions (granted_by)
where granted_by is not null;

create index if not exists credit_transactions_user_id_idx
on private.credit_transactions (user_id);

-- Assign administrators only through a trusted database migration after their
-- verified auth.users UUID is known. Never use browser-editable user metadata.

create or replace function public.get_search_allowance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := timezone('Europe/London', now())::date;
  v_credits integer;
  v_used integer;
  v_refund integer;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Sign in to view your search allowance.';
  end if;

  insert into private.user_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from private.user_accounts
  where user_id = v_user_id
  for update;

  with stale as (
    update private.vehicle_searches
    set status = 'cancelled', finished_at = now()
    where user_id = v_user_id
      and status = 'reserved'
      and created_at < now() - interval '5 minutes'
    returning credit_cost
  )
  select coalesce(sum(credit_cost), 0)::integer into v_refund from stale;

  if v_refund > 0 then
    update private.user_accounts
    set credits = credits + v_refund,
        updated_at = now()
    where user_id = v_user_id;

    insert into private.credit_transactions (user_id, amount, reason)
    values (v_user_id, v_refund, 'expired_search_reservation_refund');
  end if;

  select credits into v_credits
  from private.user_accounts
  where user_id = v_user_id;

  select count(*)::integer into v_used
  from private.vehicle_searches
  where user_id = v_user_id
    and search_date = v_today
    and status in ('reserved', 'completed');

  return jsonb_build_object(
    'dailyLimit', 5,
    'freeUsed', least(v_used, 5),
    'freeRemaining', greatest(5 - v_used, 0),
    'credits', v_credits,
    'creditCost', 2,
    'isAdmin', exists (
      select 1 from private.app_admins where user_id = v_user_id
    )
  );
end;
$$;

create or replace function public.reserve_vehicle_search(p_registration text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_registration text := upper(regexp_replace(coalesce(p_registration, ''), '[^A-Za-z0-9]', '', 'g'));
  v_today date := timezone('Europe/London', now())::date;
  v_credits integer;
  v_used integer;
  v_cost integer := 0;
  v_reservation_id uuid;
  v_refund integer;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Sign in to check a vehicle.';
  end if;

  if v_registration !~ '^[A-Z0-9]{2,8}$'
     or v_registration !~ '[A-Z]'
     or v_registration !~ '[0-9]' then
    raise invalid_parameter_value using message = 'Enter a valid UK registration number.';
  end if;

  insert into private.user_accounts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  perform 1
  from private.user_accounts
  where user_id = v_user_id
  for update;

  with stale as (
    update private.vehicle_searches
    set status = 'cancelled', finished_at = now()
    where user_id = v_user_id
      and status = 'reserved'
      and created_at < now() - interval '5 minutes'
    returning credit_cost
  )
  select coalesce(sum(credit_cost), 0)::integer into v_refund from stale;

  if v_refund > 0 then
    update private.user_accounts
    set credits = credits + v_refund,
        updated_at = now()
    where user_id = v_user_id;

    insert into private.credit_transactions (user_id, amount, reason)
    values (v_user_id, v_refund, 'expired_search_reservation_refund');
  end if;

  select credits into v_credits
  from private.user_accounts
  where user_id = v_user_id;

  select count(*)::integer into v_used
  from private.vehicle_searches
  where user_id = v_user_id
    and search_date = v_today
    and status in ('reserved', 'completed');

  if v_used >= 5 then
    v_cost := 2;
    if v_credits < v_cost then
      return jsonb_build_object(
        'allowed', false,
        'message', 'You have used today''s 5 free searches. You need 2 credits for another search.',
        'dailyLimit', 5,
        'freeUsed', 5,
        'freeRemaining', 0,
        'credits', v_credits,
        'creditCost', 2
      );
    end if;

    update private.user_accounts
    set credits = credits - v_cost,
        updated_at = now()
    where user_id = v_user_id;

    insert into private.credit_transactions (user_id, amount, reason)
    values (v_user_id, -v_cost, 'vehicle_search');

    v_credits := v_credits - v_cost;
  end if;

  insert into private.vehicle_searches (
    user_id,
    registration,
    search_date,
    credit_cost
  )
  values (
    v_user_id,
    v_registration,
    v_today,
    v_cost
  )
  returning id into v_reservation_id;

  return jsonb_build_object(
    'allowed', true,
    'reservationId', v_reservation_id,
    'dailyLimit', 5,
    'freeUsed', least(v_used + 1, 5),
    'freeRemaining', greatest(5 - (v_used + 1), 0),
    'credits', v_credits,
    'creditCost', 2,
    'chargedCredits', v_cost
  );
end;
$$;

create or replace function public.complete_vehicle_search(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Sign in to complete a vehicle search.';
  end if;

  update private.vehicle_searches
  set status = 'completed', finished_at = now()
  where id = p_reservation_id
    and user_id = v_user_id
    and status = 'reserved';

  if not found then
    raise invalid_parameter_value using message = 'The vehicle-search reservation is no longer valid.';
  end if;

  return public.get_search_allowance();
end;
$$;

create or replace function public.cancel_vehicle_search(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_refund integer;
begin
  if v_user_id is null then
    raise insufficient_privilege using message = 'Sign in to cancel a vehicle search.';
  end if;

  perform 1
  from private.user_accounts
  where user_id = v_user_id
  for update;

  update private.vehicle_searches
  set status = 'cancelled', finished_at = now()
  where id = p_reservation_id
    and user_id = v_user_id
    and status = 'reserved'
  returning credit_cost into v_refund;

  if not found then
    raise invalid_parameter_value using message = 'The vehicle-search reservation is no longer valid.';
  end if;

  if v_refund > 0 then
    update private.user_accounts
    set credits = credits + v_refund,
        updated_at = now()
    where user_id = v_user_id;

    insert into private.credit_transactions (user_id, amount, reason)
    values (v_user_id, v_refund, 'failed_vehicle_search_refund');
  end if;

  return public.get_search_allowance();
end;
$$;

create or replace function public.admin_grant_credits(p_target_email text, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_target_id uuid;
  v_target_email text;
  v_balance integer;
begin
  if v_admin_id is null or not exists (
    select 1 from private.app_admins where user_id = v_admin_id
  ) then
    raise insufficient_privilege using message = 'Only the BIISMO REG admin can grant credits.';
  end if;

  if p_amount is null or p_amount < 1 or p_amount > 100000 then
    raise invalid_parameter_value using message = 'Enter a credit amount between 1 and 100,000.';
  end if;

  select id, lower(email)
  into v_target_id, v_target_email
  from auth.users
  where lower(email) = lower(trim(p_target_email))
    and email_confirmed_at is not null
  limit 1;

  if v_target_id is null then
    raise no_data_found using message = 'No verified BIISMO REG account was found for that email.';
  end if;

  insert into private.user_accounts (user_id)
  values (v_target_id)
  on conflict (user_id) do nothing;

  update private.user_accounts
  set credits = credits + p_amount,
      updated_at = now()
  where user_id = v_target_id
  returning credits into v_balance;

  insert into private.credit_transactions (user_id, amount, reason, granted_by)
  values (v_target_id, p_amount, 'admin_grant', v_admin_id);

  return jsonb_build_object(
    'email', v_target_email,
    'granted', p_amount,
    'credits', v_balance
  );
end;
$$;

revoke all on function public.get_search_allowance() from public, anon;
revoke all on function public.reserve_vehicle_search(text) from public, anon;
revoke all on function public.complete_vehicle_search(uuid) from public, anon;
revoke all on function public.cancel_vehicle_search(uuid) from public, anon;
revoke all on function public.admin_grant_credits(text, integer) from public, anon;

grant execute on function public.get_search_allowance() to authenticated;
grant execute on function public.reserve_vehicle_search(text) to authenticated;
grant execute on function public.complete_vehicle_search(uuid) to authenticated;
grant execute on function public.cancel_vehicle_search(uuid) to authenticated;
grant execute on function public.admin_grant_credits(text, integer) to authenticated;
