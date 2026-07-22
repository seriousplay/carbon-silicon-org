-- Keep Loop OS asset-version promotion idempotent under concurrent requests.

create unique index if not exists idx_loop_os_versions_source_session_version_unique
  on public.loop_os_versions(asset_id, source_session_version_id)
  where source_session_version_id is not null;
