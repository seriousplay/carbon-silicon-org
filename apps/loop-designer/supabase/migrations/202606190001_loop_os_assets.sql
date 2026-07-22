-- Loop OS v1.0 Slice 1: enterprise loop assets and immutable versions.
-- Confirmed Loop Designer session outputs can be promoted into long-lived assets.

create table if not exists public.loop_os_assets (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  title text not null,
  domain text not null default '未分类',
  status text not null default 'incubating'
    check (status in ('incubating', 'active', 'dormant', 'retired')),
  current_version_id uuid,
  source_session_id uuid references public.loop_designer_sessions(id) on delete set null,
  matrix_workspace_id text,
  matrix_circuit_logical_id text,
  matrix_base_version_id text,
  created_by uuid not null references public.loop_designer_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.loop_os_assets is 'Loop OS enterprise-level confirmed loop assets';
comment on column public.loop_os_assets.source_session_id is 'Loop Designer session promoted into this asset; used for idempotent promotion';
comment on column public.loop_os_assets.current_version_id is 'Current immutable asset version';

create unique index if not exists idx_loop_os_assets_source_session_unique
  on public.loop_os_assets(enterprise_id, source_session_id)
  where source_session_id is not null;

create index if not exists idx_loop_os_assets_enterprise_updated
  on public.loop_os_assets(enterprise_id, updated_at desc);

create index if not exists idx_loop_os_assets_matrix_circuit
  on public.loop_os_assets(enterprise_id, matrix_workspace_id, matrix_circuit_logical_id)
  where matrix_workspace_id is not null and matrix_circuit_logical_id is not null;

create table if not exists public.loop_os_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.loop_os_assets(id) on delete cascade,
  version_number int not null check (version_number > 0),
  plan jsonb not null,
  maturity_mapping jsonb,
  birth_certificate jsonb,
  source_session_version_id text,
  change_reason text,
  created_by uuid not null references public.loop_designer_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(asset_id, version_number)
);

comment on table public.loop_os_versions is 'Immutable versions for Loop OS assets';
comment on column public.loop_os_versions.birth_certificate is 'Creation context explaining why the loop asset exists';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loop_os_assets_current_version_fk'
  ) then
    alter table public.loop_os_assets
      add constraint loop_os_assets_current_version_fk
      foreign key (current_version_id) references public.loop_os_versions(id)
      deferrable initially deferred;
  end if;
end $$;

create index if not exists idx_loop_os_versions_asset_created
  on public.loop_os_versions(asset_id, created_at desc);

alter table public.loop_os_assets enable row level security;
alter table public.loop_os_versions enable row level security;

drop policy if exists loop_os_assets_service_role on public.loop_os_assets;
create policy loop_os_assets_service_role
  on public.loop_os_assets
  for all to service_role
  using (true)
  with check (true);

drop policy if exists loop_os_versions_service_role on public.loop_os_versions;
create policy loop_os_versions_service_role
  on public.loop_os_versions
  for all to service_role
  using (true)
  with check (true);
