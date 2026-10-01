create extension if not exists "pgcrypto";

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in ('user', 'assistant')
  ),
  content text not null,
  attachment jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
on public.conversations (
  user_id,
  updated_at desc
);

create index if not exists messages_conversation_created_idx
on public.messages (
  conversation_id,
  created_at asc
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists
"Users can read their conversations"
on public.conversations;

create policy
"Users can read their conversations"
on public.conversations
for select
using (
  auth.uid() = user_id
);

drop policy if exists
"Users can create their conversations"
on public.conversations;

create policy
"Users can create their conversations"
on public.conversations
for insert
with check (
  auth.uid() = user_id
);

drop policy if exists
"Users can update their conversations"
on public.conversations;

create policy
"Users can update their conversations"
on public.conversations
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

drop policy if exists
"Users can delete their conversations"
on public.conversations;

create policy
"Users can delete their conversations"
on public.conversations
for delete
using (
  auth.uid() = user_id
);

drop policy if exists
"Users can read their messages"
on public.messages;

create policy
"Users can read their messages"
on public.messages
for select
using (
  auth.uid() = user_id
);

drop policy if exists
"Users can create their messages"
on public.messages;

create policy
"Users can create their messages"
on public.messages
for insert
with check (
  auth.uid() = user_id
);

drop policy if exists
"Users can delete their messages"
on public.messages;

create policy
"Users can delete their messages"
on public.messages
for delete
using (
  auth.uid() = user_id
);

create or replace function public.touch_conversation_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists
messages_touch_conversation
on public.messages;

create trigger
messages_touch_conversation
after insert or update
on public.messages
for each row
execute function public.touch_conversation_updated_at();