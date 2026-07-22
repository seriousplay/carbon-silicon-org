-- Loop OS v1.0 Slice 2: relationships between enterprise loop assets.
-- Parent-child and dependency edges turn assets from a list into a loop network.

create table if not exists public.loop_os_relationships (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  source_asset_id uuid not null references public.loop_os_assets(id) on delete cascade,
  target_asset_id uuid not null references public.loop_os_assets(id) on delete cascade,
  type text not null check (type in ('parent_child', 'dependency')),
  direction text not null default 'source_to_target' check (direction = 'source_to_target'),
  interface_name text,
  strength text not null default 'important' check (strength in ('critical', 'important', 'nice_to_have')),
  created_by uuid not null references public.loop_designer_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (source_asset_id <> target_asset_id),
  check (type <> 'dependency' or nullif(trim(interface_name), '') is not null)
);

comment on table public.loop_os_relationships is 'Loop OS parent-child and dependency relationships between loop assets';
comment on column public.loop_os_relationships.interface_name is 'Required for dependency relationships; names the operational interface between assets';

create index if not exists idx_loop_os_relationships_enterprise
  on public.loop_os_relationships(enterprise_id, created_at desc);

create index if not exists idx_loop_os_relationships_source
  on public.loop_os_relationships(enterprise_id, source_asset_id);

create index if not exists idx_loop_os_relationships_target
  on public.loop_os_relationships(enterprise_id, target_asset_id);

create unique index if not exists idx_loop_os_relationships_parent_child_unique
  on public.loop_os_relationships(enterprise_id, target_asset_id)
  where type = 'parent_child';

create unique index if not exists idx_loop_os_relationships_dependency_unique
  on public.loop_os_relationships(enterprise_id, source_asset_id, target_asset_id, interface_name)
  where type = 'dependency';

alter table public.loop_os_relationships enable row level security;

drop policy if exists loop_os_relationships_service_role on public.loop_os_relationships;
create policy loop_os_relationships_service_role
  on public.loop_os_relationships
  for all to service_role
  using (true)
  with check (true);
