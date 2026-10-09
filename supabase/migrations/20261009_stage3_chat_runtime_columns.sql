-- Align the live schema with the current App Router chat runtime.
-- Existing rows remain valid; historical messages are treated as complete.
alter table public.conversations
  add column if not exists model text;

alter table public.messages
  add column if not exists status text not null default 'complete',
  add column if not exists idempotency_key uuid;

alter table public.messages
  drop constraint if exists messages_status_check;

alter table public.messages
  add constraint messages_status_check
  check (status in ('pending', 'streaming', 'complete', 'interrupted', 'failed'));

create unique index if not exists messages_user_idempotency_key_uidx
  on public.messages (user_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists messages_conversation_status_created_idx
  on public.messages (conversation_id, status, created_at desc);
