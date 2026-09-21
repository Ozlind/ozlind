-- OZLIND AI Schema

-- Profiles (extends auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) primary key,
  email text,
  name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Conversations
create table if not exists conversations (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text default 'New chat',
  pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages
create table if not exists messages (
  id serial primary key,
  conversation_id integer references conversations(id) on delete cascade,
  role text not null,
  content text not null default '',
  attachments jsonb default '[]',
  created_at timestamptz default now()
);

-- Memories
create table if not exists memories (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  enabled boolean default true,
  created_at timestamptz default now()
);

-- Settings
create table if not exists settings (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  mode text default 'auto',
  research_enabled boolean default false,
  memory_enabled boolean default false,
  style text default 'balanced',
  length text default 'medium',
  instructions text default '',
  theme text default 'dark',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Usage counters
create table if not exists usage_counters (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  date text not null,
  requests_count integer default 0,
  tokens_count integer default 0,
  unique(user_id, date)
);

-- Rate limits
create table if not exists rate_limits (
  id serial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ip_address text,
  endpoint text,
  last_request timestamptz default now(),
  count integer default 0
);

-- Indexes
create index if not exists idx_conversations_user on conversations(user_id, updated_at desc);
create index if not exists idx_messages_conv on messages(conversation_id, created_at);
create index if not exists idx_memories_user on memories(user_id, created_at desc);
create index if not exists idx_settings_user on settings(user_id);
create index if not exists idx_usage_user_date on usage_counters(user_id, date);
create index if not exists idx_rate_limits_user on rate_limits(user_id, endpoint);

-- RLS
create policy "Users own conversations" on conversations for all using (auth.uid() = user_id);
create policy "Users own messages" on messages for all using (auth.uid() in (select user_id from conversations where id = messages.conversation_id));
create policy "Users own memories" on memories for all using (auth.uid() = user_id);
create policy "Users own settings" on settings for all using (auth.uid() = user_id);
create policy "Users own usage" on usage_counters for all using (auth.uid() = user_id);
create policy "Users own rate_limits" on rate_limits for all using (auth.uid() = user_id);

alter table conversations enable row level security;
alter table messages enable row level security;
alter table memories enable row level security;
alter table settings enable row level security;
alter table usage_counters enable row level security;
alter table rate_limits enable row level security;
