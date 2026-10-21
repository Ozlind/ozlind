-- Remove the SECURITY DEFINER admin helper from the exposed public API schema.
-- Apply only after reconciling this migration with the production migration ledger.
-- Keep policy semantics unchanged while moving the helper to a non-exposed schema.

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

-- Remove every currently recorded policy that calls the exposed helper, including
-- legacy policy names that may remain after a partial historical migration.
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
drop policy if exists announcements_admin_delete on public.announcements;
drop policy if exists announcements_admin_insert on public.announcements;
drop policy if exists announcements_admin_update on public.announcements;
drop policy if exists announcements_read_active on public.announcements;

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

drop policy if exists own_or_admin_select_audit_logs on public.audit_logs;
create policy own_or_admin_select_audit_logs
on public.audit_logs for select to authenticated
using (((select auth.uid()) = user_id) or (select private.is_admin()));

drop policy if exists flags_admin_delete on public.feature_flags;
drop policy if exists flags_admin_insert on public.feature_flags;
drop policy if exists flags_admin_update on public.feature_flags;
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

drop policy if exists own_or_admin_select_feedback on public.feedback;
create policy own_or_admin_select_feedback
on public.feedback for select to authenticated
using (((select auth.uid()) = user_id) or (select private.is_admin()));

drop policy if exists ozlind_profiles_select_own on public.profiles;
create policy ozlind_profiles_select_own
on public.profiles for select to authenticated
using (((select auth.uid()) = id) or (select private.is_admin()));

drop policy if exists ozlind_profiles_update_own on public.profiles;
create policy ozlind_profiles_update_own
on public.profiles for update to authenticated
using (((select auth.uid()) = id) or (select private.is_admin()))
with check (((select auth.uid()) = id) or (select private.is_admin()));

drop policy if exists ozlind_usage_logs_select on public.usage_logs;
create policy ozlind_usage_logs_select
on public.usage_logs for select to authenticated
using (((select auth.uid()) = user_id) or (select private.is_admin()));

drop function if exists public.is_admin();

-- Cover the artifacts -> conversations foreign key for deletes/joins.
create index if not exists artifacts_conversation_id_idx
on public.artifacts (conversation_id);
