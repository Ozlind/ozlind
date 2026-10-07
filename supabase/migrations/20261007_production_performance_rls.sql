-- OZLIND production performance hardening
-- Applied to production Supabase on 2026-10-07.
-- Safe/idempotent indexes plus semantically equivalent optimized RLS predicates.

create index if not exists audit_logs_user_id_idx on public.audit_logs(user_id);
create index if not exists feedback_user_id_idx on public.feedback(user_id);
create index if not exists folders_user_id_idx on public.folders(user_id);
create index if not exists ozlind_api_events_user_id_idx on public.ozlind_api_events(user_id);
create index if not exists ozlind_research_usage_conversation_id_idx on public.ozlind_research_usage(conversation_id);
create index if not exists ozlind_research_usage_user_id_idx on public.ozlind_research_usage(user_id);
create index if not exists ozlind_usage_conversation_id_idx on public.ozlind_usage(conversation_id);
create index if not exists prompts_user_id_idx on public.prompts(user_id);
create index if not exists shared_chats_user_id_idx on public.shared_chats(user_id);
create index if not exists usage_logs_conversation_id_idx on public.usage_logs(conversation_id);

drop policy if exists admin_select_audit_logs on public.audit_logs;
create policy admin_select_audit_logs on public.audit_logs for select to authenticated using ((select public.is_admin()));
drop policy if exists own_insert_audit_logs on public.audit_logs;
create policy own_insert_audit_logs on public.audit_logs for insert to public with check ((select auth.uid()) = user_id);
drop policy if exists own_select_audit_logs on public.audit_logs;
create policy own_select_audit_logs on public.audit_logs for select to public using ((select auth.uid()) = user_id);

drop policy if exists admin_select_feedback on public.feedback;
create policy admin_select_feedback on public.feedback for select to authenticated using ((select public.is_admin()));
drop policy if exists own_insert_feedback on public.feedback;
create policy own_insert_feedback on public.feedback for insert to public with check ((select auth.uid()) = user_id);
drop policy if exists own_select_feedback on public.feedback;
create policy own_select_feedback on public.feedback for select to public using ((select auth.uid()) = user_id);

drop policy if exists own_rows_folders on public.folders;
create policy own_rows_folders on public.folders for all to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists ozlind_profiles_select_own on public.profiles;
create policy ozlind_profiles_select_own on public.profiles for select to authenticated using (((select auth.uid()) = id) or (select public.is_admin()));
drop policy if exists ozlind_profiles_update_own on public.profiles;
create policy ozlind_profiles_update_own on public.profiles for update to authenticated using (((select auth.uid()) = id) or (select public.is_admin())) with check (((select auth.uid()) = id) or (select public.is_admin()));

drop policy if exists own_rows_prompts on public.prompts;
create policy own_rows_prompts on public.prompts for all to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists own_rows_shared_chats on public.shared_chats;
create policy own_rows_shared_chats on public.shared_chats for all to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists ozlind_usage_logs_insert on public.usage_logs;
create policy ozlind_usage_logs_insert on public.usage_logs for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists ozlind_usage_logs_select on public.usage_logs;
create policy ozlind_usage_logs_select on public.usage_logs for select to authenticated using (((select auth.uid()) = user_id) or (select public.is_admin()));

drop policy if exists own_rows_waitlist on public.waitlist;
create policy own_rows_waitlist on public.waitlist for all to public using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
