-- OZLIND AI — production Supabase schema
-- Idempotent: safe to run repeatedly. No destructive table drops.

create extension if not exists "pgcrypto";
create schema if not exists extensions;
create extension if not exists "vector" with schema extensions;

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
  created_at timestamptz not null default now(),
  model text,
  mode text,
  feedback smallint,
  tokens_in integer,
  tokens_out integer,
  edited_at timestamptz,
  search tsvector generated always as (
    to_tsvector('simple'::regconfig, coalesce(content, ''))
  ) stored
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at desc);

create index if not exists messages_search_idx
  on public.messages using gin (search);

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
  embedding extensions.vector(768) not null,
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
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

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
  query_embedding extensions.vector(768),
  match_threshold double precision default 0.55,
  match_count integer default 8
)
returns table (
  id uuid, document_id uuid, document_name text, chunk_index integer,
  content text, similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    dc.id,
    dc.document_id,
    d.name as document_name,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks as dc
  inner join public.documents as d
    on d.id = dc.document_id
   and d.user_id = dc.user_id
  where dc.user_id = (select auth.uid())
    and d.status = 'ready'
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding)
      >= greatest(0, least(match_threshold, 1))
  order by dc.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;
revoke all on function public.match_document_chunks(extensions.vector(768), double precision, integer)
  from public;

grant execute on function public.match_document_chunks(vector(768), double precision, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Database-backed per-user rate limiting
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
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
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 20);
  v_window_seconds integer := least(greatest(coalesce(p_window_seconds, 60), 1), 60);
  v_count integer;
  v_start timestamptz;
begin
  if v_uid is null then
    return query select false, 0, v_window_seconds;
    return;
  end if;

  insert into public.rate_limits as r (user_id, request_count, window_start)
  values (v_uid, 1, now())
  on conflict (user_id) do update
  set
    request_count = case
      when r.window_start <= now() - make_interval(secs => v_window_seconds)
        then 1
      else r.request_count + 1
    end,
    window_start = case
      when r.window_start <= now() - make_interval(secs => v_window_seconds)
        then now()
      else r.window_start
    end
  returning r.request_count, r.window_start
  into v_count, v_start;

  return query
  select
    v_count <= v_limit,
    greatest(v_limit - v_count, 0),
    greatest(1, ceil(extract(epoch from (v_start + make_interval(secs => v_window_seconds) - now())))::integer);
end;
$$;
revoke all on function public.check_rate_limit(integer, integer)
  from public;

grant execute on function public.check_rate_limit(integer, integer)
  to authenticated;


-- ---------------------------------------------------------------------------
-- Usage logging
-- ---------------------------------------------------------------------------

create table if not exists public.usage_logs (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  mode text,
  provider text,
  model text,
  tokens_in integer,
  tokens_out integer,
  latency_ms integer,
  ok boolean not null default true,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_created_idx
  on public.usage_logs (user_id, created_at desc);

create index if not exists usage_logs_conversation_id_idx
  on public.usage_logs (conversation_id);

alter table public.usage_logs enable row level security;

drop policy if exists "ozlind_usage_logs_insert" on public.usage_logs;
create policy "ozlind_usage_logs_insert"
  on public.usage_logs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "ozlind_usage_logs_select" on public.usage_logs;
create policy "ozlind_usage_logs_select"
  on public.usage_logs
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (select public.is_admin())
  );


-- ---------------------------------------------------------------------------
-- Public share lookup hardening
-- ---------------------------------------------------------------------------

create or replace function public.get_shared_chat(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', c.title,
    'shared_at', s.created_at,
    'messages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'role', m.role,
          'content', m.content,
          'sources', m.sources,
          'created_at', m.created_at
        ) order by m.created_at
      )
      from public.messages m
      where m.conversation_id = c.id
    ), '[]'::jsonb)
  )
  from public.shared_chats s
  join public.conversations c on c.id = s.conversation_id
  where p_token ~ '^[a-f0-9]{32}$'
    and s.token = p_token
    and not s.revoked;
$$;

revoke all on function public.get_shared_chat(text) from public;
grant execute on function public.get_shared_chat(text) to anon, authenticated;
