create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text,
  default_organization_id uuid references organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text unique not null,
  member_role text not null default 'member',
  status text not null default 'active',
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table organizations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table events add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table participants add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table participants add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table assessments add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table reports add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table tool_sessions add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists events_created_by_idx on events(created_by);
create index if not exists profiles_default_organization_id_idx on profiles(default_organization_id);
create index if not exists organization_members_user_id_idx on organization_members(user_id);
create index if not exists organization_members_organization_id_idx on organization_members(organization_id);
create index if not exists organization_invites_code_idx on organization_invites(code);
create index if not exists participants_user_id_idx on participants(user_id);
create index if not exists participants_organization_id_idx on participants(organization_id);
create index if not exists assessments_user_id_idx on assessments(user_id);
create index if not exists reports_user_id_idx on reports(user_id);
create index if not exists tool_sessions_user_id_idx on tool_sessions(user_id);

alter table profiles enable row level security;
alter table organization_members enable row level security;
alter table organization_invites enable row level security;

drop policy if exists "users can read own profile" on profiles;
create policy "users can read own profile"
on profiles for select
using (auth.uid() = id);

drop policy if exists "users can read own memberships" on organization_members;
create policy "users can read own memberships"
on organization_members for select
using (auth.uid() = user_id);

-- Optional reset for pre-launch test data. Uncomment only when you intentionally want a clean start.
-- truncate table assessment_answers, reports, assessments, tool_sessions, participants restart identity cascade;
