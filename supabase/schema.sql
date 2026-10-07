-- OZLIND AI — production Supabase schema
-- Idempotent: safe to run repeatedly. No destructive table drops.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  attachment jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Users can read their conversations" on public.conversations;
create policy "Users can read their conversations" on public.conversations
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create their conversations" on public.conversations;
create policy "Users can create their conversations" on public.conversations
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their conversations" on public.conversations;
create policy "Users can update their conversations" on public.conversations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their conversations" on public.conversations;
create policy "Users can delete their conversations" on public.conversations
  for delete using (auth.uid() = user_id);

drop policy if exists "Users can read their messages" on public.messages;
create policy "Users can read their messages" on public.messages
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create their messages" on public.messages;
create policy "Users can create their messages" on public.messages
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their messages" on public.messages;
create policy "Users can update their messages" on public.messages
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their messages" on public.messages;
create policy "Users can delete their messages" on public.messages
  for delete using (auth.uid() = user_id);

-- Keep conversation ordering current when messages are inserted/updated.
create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id
    and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
after insert or update on public.messages
for each row execute function public.touch_conversation_updated_at();

-- ---------------------------------------------------------------------------
-- Per-user settings
-- ---------------------------------------------------------------------------

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "Users can read their settings" on public.user_settings;
create policy "Users can read their settings" on public.user_settings
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create their settings" on public.user_settings;
create policy "Users can create their settings" on public.user_settings
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their settings" on public.user_settings;
create policy "Users can update their settings" on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their settings" on public.user_settings;
create policy "Users can delete their settings" on public.user_settings
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Private document RAG
-- ---------------------------------------------------------------------------

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mime text not null default 'text/plain',
  size_bytes bigint,
  char_count integer not null default 0,
  chunk_count integer not null default 0,
  status text not null default 'processing'
    check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  embedding vector(768) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists documents_user_created_idx
  on public.documents (user_id, created_at desc);

create index if not exists documents_user_status_idx
  on public.documents (user_id, status);

create index if not exists document_chunks_document_idx
  on public.document_chunks (document_id, chunk_index);

create index if not exists document_chunks_user_idx
  on public.document_chunks (user_id);

-- HNSW is supported by current Supabase pgvector and gives good retrieval
-- performance without requiring an exact row-count-specific tuning step.
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

drop policy if exists "Users can read their documents" on public.documents;
create policy "Users can read their documents" on public.documents
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create their documents" on public.documents;
create policy "Users can create their documents" on public.documents
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their documents" on public.documents;
create policy "Users can update their documents" on public.documents
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their documents" on public.documents;
create policy "Users can delete their documents" on public.documents
  for delete using (auth.uid() = user_id);

drop policy if exists "Users can read their document chunks" on public.document_chunks;
create policy "Users can read their document chunks" on public.document_chunks
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create their document chunks" on public.document_chunks;
create policy "Users can create their document chunks" on public.document_chunks
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.documents d
      where d.id = document_id
        and d.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their document chunks" on public.document_chunks;
create policy "Users can update their document chunks" on public.document_chunks
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their document chunks" on public.document_chunks;
create policy "Users can delete their document chunks" on public.document_chunks
  for delete using (auth.uid() = user_id);

-- Secure retrieval function. The authenticated user's id is applied inside
-- the SECURITY DEFINER function, so callers cannot retrieve another user's
-- vectors by manipulating a request parameter.
create or replace function public.match_document_chunks(
  query_embedding vector(768),
  match_threshold double precision default 0.55,
  match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  document_name text,
  chunk_index integer,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    dc.id,
    dc.document_id,
    d.name as document_name,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  join public.documents d
    on d.id = dc.document_id
   and d.user_id = auth.uid()
   and d.status = 'ready'
  where dc.user_id = auth.uid()
    and 1 - (dc.embedding <=> query_embedding) >= greatest(0, least(1, match_threshold))
  order by dc.embedding <=> query_embedding
  limit greatest(1, least(20, match_count));
$$;

revoke all on function public.match_document_chunks(vector(768), double precision, integer)
  from public;

grant execute on function public.match_document_chunks(vector(768), double precision, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Database-backed per-user rate limiting
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
    check (request_count >= 0)
);

alter table public.rate_limits enable row level security;

-- The application accesses this table only through the SECURITY DEFINER RPC.
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(
  p_limit integer default 20,
  p_window_seconds integer default 60
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(1000, coalesce(p_limit, 20)));
  v_window integer := greatest(1, least(3600, coalesce(p_window_seconds, 60)));
  v_started timestamptz;
  v_count integer;
  v_elapsed integer;
begin
  if v_user_id is null then
    return query select false, 0, 0;
    return;
  end if;

  -- Serialize requests for one user so concurrent chat requests cannot
  -- race through the counter.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select window_started_at, request_count
    into v_started, v_count
  from public.rate_limits
  where user_id = v_user_id
  for update;

  if not found or extract(epoch from (now() - v_started)) >= v_window then
    insert into public.rate_limits(user_id, window_started_at, request_count)
    values (v_user_id, now(), 1)
    on conflict (user_id) do update
      set window_started_at = excluded.window_started_at,
          request_count = 1;

    return query select true, v_limit - 1, v_window;
    return;
  end if;

  if v_count >= v_limit then
    v_elapsed := greatest(0, floor(extract(epoch from (now() - v_started)))::integer);
    return query
      select false,
             0,
             greatest(1, v_window - v_elapsed);
    return;
  end if;

  update public.rate_limits
  set request_count = request_count + 1
  where user_id = v_user_id;

  return query
    select true,
           greatest(0, v_limit - v_count - 1),
           greatest(1, v_window - floor(extract(epoch from (now() - v_started)))::integer);
end;
$$;

revoke all on function public.check_rate_limit(integer, integer)
  from public;

grant execute on function public.check_rate_limit(integer, integer)
  to authenticated;
