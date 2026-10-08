alter table public.user_preferences
  add column if not exists research_enabled boolean not null default false;
