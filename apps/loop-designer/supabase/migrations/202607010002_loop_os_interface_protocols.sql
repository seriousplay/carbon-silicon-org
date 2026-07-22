-- Loop OS P2: versioned interface protocols for dependency relationships.
-- Keeps dependency edges lightweight while making the interface contract governable.

create table if not exists public.loop_os_interface_protocols (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  relationship_id uuid not null references public.loop_os_relationships(id) on delete cascade,
  version_number int not null check (version_number > 0),
  coupling_type text not null check (coupling_type in ('hard', 'soft', 'feedback')),
  semantic_protocol jsonb not null,
  structural_protocol jsonb not null,
  governance_protocol jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'deprecated')),
  change_reason text,
  created_by uuid not null references public.loop_designer_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(relationship_id, version_number)
);

comment on table public.loop_os_interface_protocols is 'Versioned semantic, structural, and governance protocols for loop dependency interfaces';
comment on column public.loop_os_interface_protocols.coupling_type is 'hard, soft, or feedback coupling between two loop assets';

create index if not exists idx_loop_os_interface_protocols_enterprise
  on public.loop_os_interface_protocols(enterprise_id, created_at desc);

create index if not exists idx_loop_os_interface_protocols_relationship
  on public.loop_os_interface_protocols(enterprise_id, relationship_id, version_number desc);

create unique index if not exists idx_loop_os_interface_protocols_one_active
  on public.loop_os_interface_protocols(relationship_id)
  where status = 'active';

alter table public.loop_os_interface_protocols enable row level security;

drop policy if exists loop_os_interface_protocols_service_role on public.loop_os_interface_protocols;
create policy loop_os_interface_protocols_service_role
  on public.loop_os_interface_protocols
  for all to service_role
  using (true)
  with check (true);
