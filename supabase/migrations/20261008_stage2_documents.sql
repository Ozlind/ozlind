create extension if not exists vector;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  mime_type text not null,
  storage_path text,
  content text,
  embedding vector(768),
  status text not null default 'ready' check (status in ('processing','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents enable row level security;

drop policy if exists documents_select_own on public.documents;
create policy documents_select_own on public.documents for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own on public.documents for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists documents_update_own on public.documents;
create policy documents_update_own on public.documents for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists documents_delete_own on public.documents;
create policy documents_delete_own on public.documents for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists documents_user_created_idx on public.documents(user_id, created_at desc);
