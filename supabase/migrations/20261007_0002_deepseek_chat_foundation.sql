-- OZLIND AI rebuild — DeepSeek-style chat data layer
-- Milestone 2. Additive and idempotent.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  preferred_language text not null default 'en' check (preferred_language in ('en','ml','manglish')),
  theme text not null default 'system' check (theme in ('dark','light','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.touch_profile_updated_at()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_profile_updated_at();

create schema if not exists private;
create or replace function private.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),''),
    nullif(new.raw_user_meta_data ->> 'avatar_url',''))
  on conflict (id) do nothing;
  return new;
end; $$;
revoke all on function private.handle_new_user_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function private.handle_new_user_profile();

alter table public.conversations add column if not exists pinned boolean not null default false;
alter table public.conversations add column if not exists archived boolean not null default false;
alter table public.conversations add column if not exists model text;
alter table public.conversations add column if not exists mode text not null default 'fast';
alter table public.conversations add column if not exists last_message_at timestamptz;
create index if not exists conversations_user_pinned_updated_idx on public.conversations (user_id,pinned desc,updated_at desc);
create index if not exists conversations_user_archived_updated_idx on public.conversations (user_id,archived,updated_at desc);

create or replace function public.sync_conversation_message_state()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  update public.conversations set updated_at=now(),
    last_message_at=greatest(coalesce(last_message_at,'-infinity'::timestamptz),new.created_at)
  where id=new.conversation_id and user_id=new.user_id;
  return new;
end; $$;
drop trigger if exists messages_sync_conversation_state on public.messages;
create trigger messages_sync_conversation_state after insert or update on public.messages for each row execute function public.sync_conversation_message_state();

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width integer, height integer,
  status text not null default 'ready' check (status in ('uploading','ready','failed')),
  created_at timestamptz not null default now()
);
create index if not exists attachments_user_created_idx on public.attachments(user_id,created_at desc);
create index if not exists attachments_conversation_created_idx on public.attachments(conversation_id,created_at asc);
create index if not exists attachments_message_idx on public.attachments(message_id);
alter table public.attachments enable row level security;
drop policy if exists "attachments_select_own" on public.attachments;
create policy "attachments_select_own" on public.attachments for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "attachments_insert_own" on public.attachments;
create policy "attachments_insert_own" on public.attachments for insert to authenticated with check (
  (select auth.uid())=user_id and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid()))
);
drop policy if exists "attachments_update_own" on public.attachments;
create policy "attachments_update_own" on public.attachments for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "attachments_delete_own" on public.attachments;
create policy "attachments_delete_own" on public.attachments for delete to authenticated using ((select auth.uid())=user_id);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating in (-1,1)),
  note text, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(message_id,user_id)
);
create index if not exists feedback_user_created_idx on public.feedback(user_id,created_at desc);
create index if not exists feedback_message_idx on public.feedback(message_id);
alter table public.feedback enable row level security;
drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own" on public.feedback for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback for insert to authenticated with check (
  (select auth.uid())=user_id and exists(select 1 from public.messages m where m.id=message_id and m.user_id=(select auth.uid()))
);
drop policy if exists "feedback_update_own" on public.feedback;
create policy "feedback_update_own" on public.feedback for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "feedback_delete_own" on public.feedback;
create policy "feedback_delete_own" on public.feedback for delete to authenticated using ((select auth.uid())=user_id);
create or replace function public.touch_feedback_updated_at()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists feedback_touch_updated_at on public.feedback;
create trigger feedback_touch_updated_at before update on public.feedback for each row execute function public.touch_feedback_updated_at();

create table if not exists public.conversation_memory (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null default '',
  key_facts jsonb not null default '[]'::jsonb,
  message_count integer not null default 0 check(message_count>=0),
  summarized_through timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists conversation_memory_user_updated_idx on public.conversation_memory(user_id,updated_at desc);
alter table public.conversation_memory enable row level security;
drop policy if exists "conversation_memory_select_own" on public.conversation_memory;
create policy "conversation_memory_select_own" on public.conversation_memory for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "conversation_memory_insert_own" on public.conversation_memory;
create policy "conversation_memory_insert_own" on public.conversation_memory for insert to authenticated with check (
  (select auth.uid())=user_id and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid()))
);
drop policy if exists "conversation_memory_update_own" on public.conversation_memory;
create policy "conversation_memory_update_own" on public.conversation_memory for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "conversation_memory_delete_own" on public.conversation_memory;
create policy "conversation_memory_delete_own" on public.conversation_memory for delete to authenticated using ((select auth.uid())=user_id);
create or replace function public.touch_conversation_memory_updated_at()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists conversation_memory_touch_updated_at on public.conversation_memory;
create trigger conversation_memory_touch_updated_at before update on public.conversation_memory for each row execute function public.touch_conversation_memory_updated_at();

create table if not exists public.shared_chats (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(18),'base64url'),
  title text not null, snapshot jsonb not null default '{}'::jsonb,
  expires_at timestamptz, revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists shared_chats_user_created_idx on public.shared_chats(user_id,created_at desc);
create index if not exists shared_chats_token_idx on public.shared_chats(token);
alter table public.shared_chats enable row level security;
drop policy if exists "shared_chats_select_own" on public.shared_chats;
create policy "shared_chats_select_own" on public.shared_chats for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "shared_chats_insert_own" on public.shared_chats;
create policy "shared_chats_insert_own" on public.shared_chats for insert to authenticated with check (
  (select auth.uid())=user_id and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid()))
);
drop policy if exists "shared_chats_update_own" on public.shared_chats;
create policy "shared_chats_update_own" on public.shared_chats for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "shared_chats_delete_own" on public.shared_chats;
create policy "shared_chats_delete_own" on public.shared_chats for delete to authenticated using ((select auth.uid())=user_id);

insert into storage.buckets(id,name,public,file_size_limit)
values('ozlind-uploads','ozlind-uploads',false,10485760)
on conflict(id) do update set public=false,file_size_limit=10485760;
drop policy if exists "ozlind_uploads_select_own" on storage.objects;
create policy "ozlind_uploads_select_own" on storage.objects for select to authenticated using (
 bucket_id='ozlind-uploads' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists "ozlind_uploads_insert_own" on storage.objects;
create policy "ozlind_uploads_insert_own" on storage.objects for insert to authenticated with check (
 bucket_id='ozlind-uploads' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists "ozlind_uploads_update_own" on storage.objects;
create policy "ozlind_uploads_update_own" on storage.objects for update to authenticated using (
 bucket_id='ozlind-uploads' and (storage.foldername(name))[1]=(select auth.uid())::text
) with check (
 bucket_id='ozlind-uploads' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists "ozlind_uploads_delete_own" on storage.objects;
create policy "ozlind_uploads_delete_own" on storage.objects for delete to authenticated using (
 bucket_id='ozlind-uploads' and (storage.foldername(name))[1]=(select auth.uid())::text
);

create index if not exists messages_conversation_role_created_idx on public.messages(conversation_id,role,created_at asc);
create index if not exists messages_user_updated_search_idx on public.messages(user_id,created_at desc);

drop policy if exists "Users can create their messages" on public.messages;
create policy "Users can create their messages" on public.messages for insert to authenticated with check (
 (select auth.uid())=user_id and exists(select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid()))
);
