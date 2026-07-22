-- Keep each active Matrix Circuit bound to at most one non-retired Loop OS asset.

create unique index if not exists idx_loop_os_assets_matrix_circuit_active_unique
  on public.loop_os_assets(enterprise_id, matrix_workspace_id, matrix_circuit_logical_id)
  where matrix_workspace_id is not null
    and matrix_circuit_logical_id is not null
    and status <> 'retired';
