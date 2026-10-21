-- Remove the SECURITY DEFINER admin helper from the exposed public API schema.
-- The historical production migration ledger does not map one-to-one to repository filenames;
-- preserve the live ledger and apply this as a new additive migration.
-- Policy behavior stays equivalent, and trigger callers are updated before the old
-- function is dropped so profile writes remain safe.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and not banned
  );
$function$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- This trigger's PL/pgSQL body is not recorded as a pg_depend reference, so it
-- must explicitly switch to the private helper before public.is_admin is removed.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is not null and not private.is_admin() then
    new.role := old.role;
    new.banned := old.banned;
    new.daily_limit := old.daily_limit;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

-- Table ACLs are independent of RLS. TRUNCATE, TRIGGER, REFERENCES and
-- MAINTAIN are not part of the row-level CRUD contract required by the client.
-- Remove them from every existing table in the exposed public schema while
-- preserving SELECT/INSERT/UPDATE/DELETE and service_role's server-side access.
revoke truncate, references, trigger, maintain
on all tables in schema public
from public, anon, authenticated;

-- Prevent these privileges from silently returning on future app tables created
-- by the repository's migration owner. Existing Supabase-managed role defaults
-- are left untouched.
alter default privileges for role postgres in schema public
revoke truncate, references, trigger, maintain on tables
from public, anon, authenticated;

-- Remove every recorded policy that calls the exposed helper, including legacy
-- policy names that may remain after partial historical migrations.
do $migration$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('announcements', 'audit_logs', 'feature_flags', 'feedback', 'profiles', 'usage_logs')
      and (
        coalesce(qual, '') ilike '%is_admin%'
        or coalesce(with_check, '') ilike '%is_admin%'
      )
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end
$migration$;

-- Recreate the observed policy set using the private helper.
create policy announcements_read_active
on public.announcements for select to authenticated
using (active = true or (select private.is_admin()));
create policy announcements_admin_insert
on public.announcements for insert to authenticated
with check ((select private.is_admin()));
create policy announcements_admin_update
on public.announcements for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy announcements_admin_delete
on public.announcements for delete to authenticated
using ((select private.is_admin()));

create policy own_or_admin_select_audit_logs
on public.audit_logs for select to authenticated
using (((select auth.uid()) = user_id) or (select private.is_admin()));

create policy flags_admin_insert
on public.feature_flags for insert to authenticated
with check ((select private.is_admin()));
create policy flags_admin_update
on public.feature_flags for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));
create policy flags_admin_delete
on public.feature_flags for delete to authenticated
using ((select private.is_admin()));

create policy own_or_admin_select_feedback
on public.feedback for select to authenticated
using (((select auth.uid()) = user_id) or (select private.is_admin()));

create policy ozlind_profiles_select_own
on public.profiles for select to authenticated
using (((select auth.uid()) = id) or (select private.is_admin()));
create policy ozlind_profiles_update_own
on public.profiles for update to authenticated
using (((select auth.uid()) = id) or (select private.is_admin()))
with check (((select auth.uid()) = id) or (select private.is_admin()));

create policy ozlind_usage_logs_select
on public.usage_logs for select to authenticated
using (((select auth.uid()) = user_id) or (select private.is_admin()));

drop function if exists public.is_admin();

-- Cover the artifacts -> conversations foreign key for deletes/joins.
create index if not exists artifacts_conversation_id_idx
on public.artifacts (conversation_id);
