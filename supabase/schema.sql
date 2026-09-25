create table if not exists public.profiles (
  id uuid primary key references auth.users(id)
    on delete cascade,

  email text,
  full_name text,
  avatar_url text,

  role text not null default 'user'
    check (role in ('user', 'admin')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;


create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
);


create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


drop trigger if exists on_auth_user_created
on auth.users;


create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();