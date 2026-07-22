create extension if not exists pgcrypto;

create table if not exists public.loop_designer_users (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null,
  open_id text not null,
  union_id text,
  feishu_user_id text,
  display_name text not null,
  avatar_url text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  unique (tenant_key, open_id)
);

create table if not exists public.loop_designer_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.loop_designer_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists loop_designer_auth_sessions_user_idx
  on public.loop_designer_auth_sessions (user_id, created_at desc);
create index if not exists loop_designer_auth_sessions_expiry_idx
  on public.loop_designer_auth_sessions (expires_at)
  where revoked_at is null;

create table if not exists public.loop_designer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.loop_designer_users(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'generating', 'submitted', 'failed')),
  participant_snapshot jsonb not null default '{}'::jsonb,
  context jsonb not null default '{"currentStep": 0}'::jsonb,
  responses jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{"messages": [], "versions": [], "refinementCount": 0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists loop_designer_sessions_user_created_idx
  on public.loop_designer_sessions (user_id, created_at desc);

alter table public.loop_designer_users enable row level security;
alter table public.loop_designer_auth_sessions enable row level security;
alter table public.loop_designer_sessions enable row level security;

revoke all on public.loop_designer_users from anon, authenticated;
revoke all on public.loop_designer_auth_sessions from anon, authenticated;
revoke all on public.loop_designer_sessions from anon, authenticated;
