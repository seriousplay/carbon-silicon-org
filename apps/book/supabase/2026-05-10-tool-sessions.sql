create table if not exists tool_sessions (
  id uuid primary key default gen_random_uuid(),
  tool_id text not null,
  event_id uuid references events(id) on delete set null,
  organization_id uuid references organizations(id) on delete set null,
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

alter table tool_sessions add column if not exists organization_id uuid;
alter table tool_sessions add column if not exists participant_id uuid;
alter table tool_sessions add column if not exists participant_snapshot jsonb not null default '{}'::jsonb;
alter table tool_sessions add column if not exists context jsonb not null default '{}'::jsonb;
alter table tool_sessions add column if not exists responses jsonb not null default '{}'::jsonb;
alter table tool_sessions add column if not exists outputs jsonb not null default '{}'::jsonb;
alter table tool_sessions add column if not exists submitted_at timestamptz not null default now();

create index if not exists tool_sessions_tool_id_idx on tool_sessions(tool_id);
create index if not exists tool_sessions_event_id_idx on tool_sessions(event_id);
create index if not exists tool_sessions_organization_id_idx on tool_sessions(organization_id);
create index if not exists tool_sessions_submitted_at_idx on tool_sessions(submitted_at desc);

alter table tool_sessions enable row level security;
