-- Loop OS v1.0 Slice 5: persisted organization profile snapshots.
-- The profile is the long-memory summary Matrix Origin and generation flows can reuse.

create table if not exists public.loop_os_org_profiles (
  enterprise_id uuid primary key references public.loop_designer_enterprises(id) on delete cascade,
  profile jsonb not null,
  source text not null default 'loop_os_v1',
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loop_os_org_profiles is 'Persisted Loop OS organization profile snapshots';
comment on column public.loop_os_org_profiles.profile is 'Computed long-memory summary for an enterprise loop network';
comment on column public.loop_os_org_profiles.computed_at is 'When this organization profile snapshot was computed';

alter table public.loop_os_org_profiles enable row level security;

drop policy if exists loop_os_org_profiles_service_role on public.loop_os_org_profiles;
create policy loop_os_org_profiles_service_role
  on public.loop_os_org_profiles
  for all to service_role
  using (true)
  with check (true);
