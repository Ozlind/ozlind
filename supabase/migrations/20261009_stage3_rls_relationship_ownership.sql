-- Tighten relationship ownership checks in RLS policies.
drop policy if exists ozlind_messages_insert_own on public.messages;
create policy ozlind_messages_insert_own on public.messages
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = (select auth.uid())
    )
  );

-- A document chunk must always belong to a document owned by the same user.
drop policy if exists ozlind_document_chunks_own on public.document_chunks;
create policy ozlind_document_chunks_select_own on public.document_chunks
  for select to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );
create policy ozlind_document_chunks_insert_own on public.document_chunks
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );
create policy ozlind_document_chunks_update_own on public.document_chunks
  for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );
create policy ozlind_document_chunks_delete_own on public.document_chunks
  for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = (select auth.uid())
    )
  );

-- Remove a redundant permissive policy; command-specific ownership policies remain.
drop policy if exists ozlind_documents_own on public.documents;