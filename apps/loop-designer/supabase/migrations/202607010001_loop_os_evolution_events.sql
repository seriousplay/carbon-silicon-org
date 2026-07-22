-- Loop OS P1: continuous run records and release events.
-- Stores every run round without a fixed cap, plus trial/production releases.

create table if not exists public.loop_os_evolution_events (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  asset_id uuid not null references public.loop_os_assets(id) on delete cascade,
  version_id uuid references public.loop_os_versions(id) on delete set null,
  event_type text not null check (event_type in (
    'run_round',
    'version_released',
    'validation_result',
    'guardrail_update',
    'memory_lesson',
    'interface_change'
  )),
  run_sequence int check (run_sequence is null or run_sequence > 0),
  run_mode text check (run_mode is null or run_mode in ('trial', 'production')),
  payload jsonb not null,
  created_by uuid not null references public.loop_designer_users(id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.loop_os_evolution_events is 'Continuous Loop OS run records, validation lessons, and version release events';
comment on column public.loop_os_evolution_events.run_sequence is 'Positive sequence number for every run round; not capped to three rounds';
comment on column public.loop_os_evolution_events.run_mode is 'trial or production run mode for a run round';

create index if not exists idx_loop_os_evolution_events_asset_created
  on public.loop_os_evolution_events(enterprise_id, asset_id, created_at desc);

create index if not exists idx_loop_os_evolution_events_asset_run
  on public.loop_os_evolution_events(enterprise_id, asset_id, run_sequence)
  where event_type = 'run_round';

create index if not exists idx_loop_os_evolution_events_release
  on public.loop_os_evolution_events(enterprise_id, asset_id, created_at desc)
  where event_type = 'version_released';

alter table public.loop_os_evolution_events enable row level security;

drop policy if exists loop_os_evolution_events_service_role on public.loop_os_evolution_events;
create policy loop_os_evolution_events_service_role
  on public.loop_os_evolution_events
  for all to service_role
  using (true)
  with check (true);
