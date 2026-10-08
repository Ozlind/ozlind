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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists user_preferences_delete_own on public.user_preferences;
create policy user_preferences_delete_own on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.touch_user_preferences()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_preferences_touch on public.user_preferences;
create trigger user_preferences_touch
before update on public.user_preferences
for each row execute function public.touch_user_preferences();
