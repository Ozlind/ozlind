-- OZLIND AI — Supabase schema
-- Run this in the Supabase SQL editor for a fresh project.
-- (In this workspace the equivalent tables were created via the platform's
-- table-management tooling, which is functionally identical to this script.)

create extension if not exists "pgcrypto";

-- Public profile row, one per authenticated user.
create table if not exists profiles (
  id uuid primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- A conversation (chat thread) owned by a user.
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_id_idx on conversations (user_id);
create index if not exists conversations_updated_at_idx on conversations (updated_at desc);

-- Messages inside a conversation.
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_id_idx on messages (conversation_id);
create index if not exists messages_created_at_idx on messages (created_at);

-- Per-user settings (memory, mode, style, custom instructions).
create table if not exists user_settings (
  user_id uuid primary key,
  memory_enabled boolean not null default true,
  research_enabled boolean not null default false,
  preferred_mode text not null default 'auto',
  response_style text not null default 'balanced',
  response_length text not null default 'medium',
  custom_instructions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security: every user can only read/write their own rows.
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table user_settings enable row level security;

create policy profiles_select on profiles for select using (auth.uid() = id);
create policy profiles_insert on profiles for insert with check (auth.uid() = id);
create policy profiles_update on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy conversations_select on conversations for select using (auth.uid() = user_id);
create policy conversations_insert on conversations for insert with check (auth.uid() = user_id);
create policy conversations_update on conversations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy conversations_delete on conversations for delete using (auth.uid() = user_id);

create policy messages_select on messages for select using (
  conversation_id in (select id from conversations where user_id = auth.uid())
);
create policy messages_insert on messages for insert with check (
  conversation_id in (select id from conversations where user_id = auth.uid())
);
create policy messages_update on messages for update using (
  conversation_id in (select id from conversations where user_id = auth.uid())
);
create policy messages_delete on messages for delete using (
  conversation_id in (select id from conversations where user_id = auth.uid())
);

create policy user_settings_select on user_settings for select using (auth.uid() = user_id);
create policy user_settings_insert on user_settings for insert with check (auth.uid() = user_id);
create policy user_settings_update on user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
