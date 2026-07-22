create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  event_date date,
  access_code text,
  status text not null default 'draft',
  run_type text not null default 'workshop',
  audience text,
  description text,
  show_on_home boolean not null default false,
  start_date timestamptz,
  end_date timestamptz,
  config jsonb not null default '{}'::jsonb,
  organization_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  org_type text not null default 'company',
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

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

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  display_name text not null,
  role text,
  industry text,
  org_size text,
  company_name text,
  contact text,
  contact_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id text primary key,
  module text not null,
  dimension text,
  title text not null,
  description text,
  question_type text not null,
  sort_order int not null
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'in_progress',
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists assessment_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  question_id text not null,
  numeric_value numeric,
  text_value text,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  stage_level text,
  next_level text,
  stage_summary text,
  spiral_scores jsonb not null default '{}'::jsonb,
  energy_scores jsonb not null default '{}'::jsonb,
  chain_score numeric,
  charter_score numeric,
  primary_bottleneck text,
  action_recommendation jsonb not null default '{}'::jsonb,
  recommended_tools jsonb not null default '[]'::jsonb,
  participant_snapshot jsonb not null default '{}'::jsonb,
  open_answers jsonb not null default '{}'::jsonb,
  report_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tools (
  id text primary key,
  chapter int not null,
  name text not null,
  purpose text not null,
  output text,
  content_markdown text not null,
  sort_order int not null
);

create table if not exists tool_sessions (
  id uuid primary key default gen_random_uuid(),
  tool_id text not null,
  event_id uuid references events(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  participant_id uuid references participants(id) on delete set null,
  mode text not null default 'standalone',
  status text not null default 'submitted',
  participant_snapshot jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  responses jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'facilitator',
  created_at timestamptz not null default now()
);

insert into events (slug, title, event_date, status)
values ('20260517-hr-od-workshop', '碳硅共生：AI时代的组织进化工作坊', '2026-05-17', 'active')
on conflict (slug) do update
set title = excluded.title,
    event_date = excluded.event_date,
    status = excluded.status;

alter table events add column if not exists run_type text not null default 'workshop';
alter table events add column if not exists audience text;
alter table events add column if not exists description text;
alter table events add column if not exists show_on_home boolean not null default false;
alter table events add column if not exists start_date timestamptz;
alter table events add column if not exists end_date timestamptz;
alter table events add column if not exists config jsonb not null default '{}'::jsonb;
alter table events add column if not exists organization_id uuid;
alter table events add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table organizations add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table participants add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table participants add column if not exists organization_id uuid references organizations(id) on delete set null;
alter table assessments add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table reports add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists events_run_type_idx on events(run_type);
create index if not exists events_status_idx on events(status);
create index if not exists events_show_on_home_idx on events(show_on_home);
create index if not exists events_organization_id_idx on events(organization_id);
create index if not exists events_created_by_idx on events(created_by);
create index if not exists organizations_status_idx on organizations(status);
create index if not exists profiles_default_organization_id_idx on profiles(default_organization_id);
create index if not exists organization_members_user_id_idx on organization_members(user_id);
create index if not exists organization_members_organization_id_idx on organization_members(organization_id);
create index if not exists organization_invites_code_idx on organization_invites(code);
create index if not exists participants_user_id_idx on participants(user_id);
create index if not exists participants_organization_id_idx on participants(organization_id);
create index if not exists assessments_user_id_idx on assessments(user_id);
create index if not exists reports_user_id_idx on reports(user_id);
create index if not exists tool_sessions_tool_id_idx on tool_sessions(tool_id);
create index if not exists tool_sessions_event_id_idx on tool_sessions(event_id);
create index if not exists tool_sessions_organization_id_idx on tool_sessions(organization_id);
create index if not exists tool_sessions_user_id_idx on tool_sessions(user_id);
create index if not exists tool_sessions_submitted_at_idx on tool_sessions(submitted_at desc);

update events
set run_type = coalesce(nullif(run_type, ''), 'workshop'),
    audience = coalesce(audience, 'HR 一号位与组织发展负责人'),
    description = coalesce(
      description,
      '基于《碳硅组织》的实践框架，围绕真实组织问题完成一次诊断、方法共创和人机协作实验设计。'
    ),
    show_on_home = true,
    config = coalesce(config, '{}'::jsonb)
where slug = '20260517-hr-od-workshop';

alter table events enable row level security;
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table organization_members enable row level security;
alter table organization_invites enable row level security;
alter table participants enable row level security;
alter table questions enable row level security;
alter table assessments enable row level security;
alter table assessment_answers enable row level security;
alter table reports enable row level security;
alter table tools enable row level security;
alter table tool_sessions enable row level security;
alter table admin_profiles enable row level security;

alter table reports add column if not exists stage_summary text;
alter table reports add column if not exists participant_snapshot jsonb not null default '{}'::jsonb;
alter table reports add column if not exists open_answers jsonb not null default '{}'::jsonb;
alter table reports add column if not exists report_payload jsonb not null default '{}'::jsonb;

alter table tool_sessions add column if not exists organization_id uuid;
alter table tool_sessions add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table tool_sessions add column if not exists participant_id uuid;
alter table tool_sessions add column if not exists participant_snapshot jsonb not null default '{}'::jsonb;
alter table tool_sessions add column if not exists context jsonb not null default '{}'::jsonb;
alter table tool_sessions add column if not exists responses jsonb not null default '{}'::jsonb;
alter table tool_sessions add column if not exists outputs jsonb not null default '{}'::jsonb;
alter table tool_sessions add column if not exists submitted_at timestamptz not null default now();

drop policy if exists "public can read active events" on events;
create policy "public can read active events"
on events for select
using (status = 'active');

drop policy if exists "public can read active organizations" on organizations;
create policy "public can read active organizations"
on organizations for select
using (status = 'active');

drop policy if exists "users can read own profile" on profiles;
create policy "users can read own profile"
on profiles for select
using (auth.uid() = id);

drop policy if exists "users can read own memberships" on organization_members;
create policy "users can read own memberships"
on organization_members for select
using (auth.uid() = user_id);

drop policy if exists "public can insert participants" on participants;
drop policy if exists "public can insert assessments" on assessments;
drop policy if exists "public can insert answers" on assessment_answers;
drop policy if exists "public can insert reports" on reports;

drop policy if exists "public can read questions" on questions;
create policy "public can read questions"
on questions for select
using (true);

drop policy if exists "public can read tools" on tools;
create policy "public can read tools"
on tools for select
using (true);
