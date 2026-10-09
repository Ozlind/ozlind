-- Artifacts may reference a conversation only when it belongs to the same user.
drop policy if exists artifacts_own on public.artifacts;
create policy artifacts_select_own on public.artifacts
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.user_id = (select auth.uid())
      )
    )
  );
create policy artifacts_insert_own on public.artifacts
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.user_id = (select auth.uid())
      )
    )
  );
create policy artifacts_update_own on public.artifacts
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.user_id = (select auth.uid())
      )
    )
  )
  with check (
    (select auth.uid()) = user_id
    and (
      conversation_id is null
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id and c.user_id = (select auth.uid())
      )
    )
  );
create policy artifacts_delete_own on public.artifacts
  for delete to authenticated
  using ((select auth.uid()) = user_id);