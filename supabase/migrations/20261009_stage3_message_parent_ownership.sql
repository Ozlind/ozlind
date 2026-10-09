drop policy if exists ozlind_messages_select_own on public.messages;
create policy ozlind_messages_select_own on public.messages
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
drop policy if exists ozlind_messages_update_own on public.messages;
create policy ozlind_messages_update_own on public.messages
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
drop policy if exists ozlind_messages_delete_own on public.messages;
create policy ozlind_messages_delete_own on public.messages
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );