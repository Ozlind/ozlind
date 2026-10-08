create table if not exists public.presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  system_prompt text not null check (char_length(system_prompt) <= 12000),
  model text not null default 'groq:llama-3.3-70b-versatile',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.presets enable row level security;
alter table public.artifacts enable row level security;

drop policy if exists presets_own on public.presets;
create policy presets_own on public.presets for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists artifacts_own on public.artifacts;
create policy artifacts_own on public.artifacts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists presets_user_updated_idx on public.presets(user_id, updated_at desc);
create index if not exists artifacts_user_updated_idx on public.artifacts(user_id, updated_at desc);
