-- Reconcile document metadata with the API contract without dropping legacy columns or rows.
-- Existing databases may have mime_type/content/embedding from the earlier RAG schema.
alter table public.documents
  add column if not exists mime text,
  add column if not exists size_bytes bigint,
  add column if not exists char_count integer,
  add column if not exists chunk_count integer not null default 0;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'mime_type'
  ) then
    execute $sql$
      update public.documents
      set mime = mime_type
      where mime_type is not null
        and btrim(mime_type) <> ''
        and (mime is null or btrim(mime) = '' or mime = 'text/plain')
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'content'
  ) then
    execute $sql$
      update public.documents
      set char_count = char_length(content)
      where char_count is null and content is not null
    $sql$;
  end if;
end
$$;

update public.documents set mime = 'text/plain' where mime is null or btrim(mime) = '';
update public.documents set char_count = 0 where char_count is null;
update public.documents set chunk_count = 0 where chunk_count is null;

alter table public.documents
  alter column mime set default 'text/plain',
  alter column mime set not null,
  alter column char_count set default 0,
  alter column char_count set not null,
  alter column chunk_count set default 0,
  alter column chunk_count set not null;

-- The ingestion path always writes an embedding for every chunk. Fail rather than
-- silently discard rows if historical data violates that invariant.
alter table public.document_chunks
  alter column embedding set not null;

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);
