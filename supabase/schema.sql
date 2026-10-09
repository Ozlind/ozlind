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
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  status text not null default 'complete' check (status in ('pending', 'streaming', 'complete', 'interrupted', 'failed')),
  idempotency_key uuid,
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

-- Reconcile databases created from earlier schema versions.
alter table public.conversations add column if not exists model text;
alter table public.messages
  add column if not exists status text not null default 'complete',
  add column if not exists idempotency_key uuid;
alter table public.messages drop constraint if exists messages_status_check;
alter table public.messages add constraint messages_status_check
  check (status in ('pending', 'streaming', 'complete', 'interrupted', 'failed'));

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at desc);

create unique index if not exists messages_user_idempotency_key_uidx
  on public.messages (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists messages_conversation_status_created_idx
  on public.messages (conversation_id, status, created_at desc);

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
  for select using (
    auth.uid() = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

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
  for update using (
    auth.uid() = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their messages" on public.messages;
create policy "Users can delete their messages" on public.messages
  for delete using (
    auth.uid() = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

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
  for select using (
    auth.uid() = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
  );

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
  for update using (
    auth.uid() = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their document chunks" on public.document_chunks;
create policy "Users can delete their document chunks" on public.document_chunks
  for delete using (
    auth.uid() = user_id
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.user_id = auth.uid()
    )
  );

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
-- User preferences and workspace data
-- ---------------------------------------------------------------------------

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  accent text not null default '#E26F4A' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  language text not null default 'en' check (language in ('en','ml')),
  density text not null default 'comfortable' check (density in ('compact','comfortable','spacious')),
  code_theme text not null default 'default',
  layout text not null default 'standard' check (layout in ('standard','wide')),
  default_model text not null default 'groq:llama-3.3-70b-versatile',
  enter_to_send boolean not null default true,
  auto_scroll boolean not null default true,
  show_reasoning boolean not null default false,
  research_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences add column if not exists research_enabled boolean not null default false;
alter table public.user_preferences enable row level security;
drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own on public.user_preferences for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own on public.user_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists user_preferences_delete_own on public.user_preferences;
create policy user_preferences_delete_own on public.user_preferences for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  system_prompt text not null check (char_length(system_prompt) <= 12000),
  model text not null default 'groq:llama-3.3-70b-versatile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.presets enable row level security;
drop policy if exists presets_own on public.presets;
create policy presets_own on public.presets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create index if not exists presets_user_updated_idx on public.presets(user_id, updated_at desc);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null,
  kind text not null default 'text' check (kind in ('text','code','markdown','json')),
  content text not null default '',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.artifacts enable row level security;
drop policy if exists artifacts_own on public.artifacts;
drop policy if exists artifacts_select_own on public.artifacts;
drop policy if exists artifacts_insert_own on public.artifacts;
drop policy if exists artifacts_update_own on public.artifacts;
drop policy if exists artifacts_delete_own on public.artifacts;
create policy artifacts_select_own on public.artifacts for select to authenticated
  using ((select auth.uid()) = user_id and (conversation_id is null or exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))));
create policy artifacts_insert_own on public.artifacts for insert to authenticated
  with check ((select auth.uid()) = user_id and (conversation_id is null or exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))));
create policy artifacts_update_own on public.artifacts for update to authenticated
  using ((select auth.uid()) = user_id and (conversation_id is null or exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))))
  with check ((select auth.uid()) = user_id and (conversation_id is null or exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))));
create policy artifacts_delete_own on public.artifacts for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists artifacts_user_updated_idx on public.artifacts(user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Database-backed per-user rate limiting
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

drop function if exists public.check_rate_limit(integer, integer);
create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_limit integer default 20,
  p_window_seconds integer default 60
)
returns table (allowed boolean, remaining integer, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := p_user_id;
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
      when r.window_start <= now() - make_interval(secs => v_window_seconds) then 1
      else r.request_count + 1
    end,
    window_start = case
      when r.window_start <= now() - make_interval(secs => v_window_seconds) then now()
      else r.window_start
    end
  returning r.request_count, r.window_start into v_count, v_start;

  return query
  select
    v_count <= v_limit,
    greatest(v_limit - v_count, 0),
    greatest(1, ceil(extract(epoch from (
      v_start + make_interval(secs => v_window_seconds) - now()
    )))::integer);
end;
$$;

revoke all on function public.check_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, integer, integer) to service_role;
