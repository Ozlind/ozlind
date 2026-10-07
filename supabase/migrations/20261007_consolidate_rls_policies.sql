-- Consolidate overlapping RLS policies without changing effective access.
-- Applied to production Supabase on 2026-10-07.

drop policy if exists announcements_admin_write on public.announcements;
drop policy if exists announcements_read_active on public.announcements;
create policy announcements_read_active
on public.announcements for select to authenticated
using ((active = true) or (select public.is_admin()));
create policy announcements_admin_insert
on public.announcements for insert to authenticated
with check ((select public.is_admin()));
create policy announcements_admin_update
on public.announcements for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy announcements_admin_delete
on public.announcements for delete to authenticated
using ((select public.is_admin()));

drop policy if exists flags_admin_write on public.feature_flags;
drop policy if exists flags_read on public.feature_flags;
create policy flags_read
on public.feature_flags for select to authenticated using (true);
create policy flags_admin_insert
on public.feature_flags for insert to authenticated
with check ((select public.is_admin()));
create policy flags_admin_update
on public.feature_flags for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy flags_admin_delete
on public.feature_flags for delete to authenticated
using ((select public.is_admin()));

drop policy if exists admin_select_audit_logs on public.audit_logs;
drop policy if exists own_select_audit_logs on public.audit_logs;
create policy own_or_admin_select_audit_logs
on public.audit_logs for select to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists admin_select_feedback on public.feedback;
drop policy if exists own_select_feedback on public.feedback;
create policy own_or_admin_select_feedback
on public.feedback for select to authenticated
using (((select auth.uid()) = user_id) or (select public.is_admin()));
