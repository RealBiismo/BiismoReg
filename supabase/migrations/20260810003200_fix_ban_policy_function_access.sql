create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and (banned_until is null or banned_until <= now())
  );
$$;

revoke all on function public.current_user_is_active() from public, anon;
grant execute on function public.current_user_is_active() to authenticated;

drop policy if exists "Users can view their own saved vehicles" on public.saved_vehicles;
drop policy if exists "Users can save their own vehicles" on public.saved_vehicles;
drop policy if exists "Users can update their own saved vehicles" on public.saved_vehicles;
drop policy if exists "Users can remove their own saved vehicles" on public.saved_vehicles;

create policy "Users can view their own saved vehicles"
on public.saved_vehicles
for select
to authenticated
using ((select auth.uid()) = user_id and public.current_user_is_active());

create policy "Users can save their own vehicles"
on public.saved_vehicles
for insert
to authenticated
with check ((select auth.uid()) = user_id and public.current_user_is_active());

create policy "Users can update their own saved vehicles"
on public.saved_vehicles
for update
to authenticated
using ((select auth.uid()) = user_id and public.current_user_is_active())
with check ((select auth.uid()) = user_id and public.current_user_is_active());

create policy "Users can remove their own saved vehicles"
on public.saved_vehicles
for delete
to authenticated
using ((select auth.uid()) = user_id and public.current_user_is_active());
