create table if not exists public.loop_designer_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.loop_designer_sessions(id) on delete cascade,
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  user_id uuid not null references public.loop_designer_users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  use_org_memory boolean not null default true,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 2 check (max_attempts >= 1),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists loop_designer_generation_jobs_enterprise_status_idx
  on public.loop_designer_generation_jobs (enterprise_id, status, created_at);

create index if not exists loop_designer_generation_jobs_session_created_idx
  on public.loop_designer_generation_jobs (enterprise_id, session_id, created_at desc);

create index if not exists loop_designer_generation_jobs_running_lock_idx
  on public.loop_designer_generation_jobs (status, locked_at)
  where status = 'running';

create unique index if not exists loop_designer_generation_jobs_one_active_per_session_idx
  on public.loop_designer_generation_jobs (session_id)
  where status in ('queued', 'running');

alter table public.loop_designer_generation_jobs enable row level security;
revoke all on public.loop_designer_generation_jobs from anon, authenticated;

notify pgrst, 'reload schema';
