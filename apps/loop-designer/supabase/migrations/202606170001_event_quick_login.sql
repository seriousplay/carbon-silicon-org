-- Allow temporary event-code authentication for external enterprise users.

do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'loop_designer_users'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%auth_provider%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.loop_designer_users drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.loop_designer_users
  add constraint loop_designer_users_auth_provider_check
  check (auth_provider in ('feishu', 'email', 'event'));

create index if not exists loop_designer_enterprises_event_source_idx
  on public.loop_designer_enterprises ((feature_flags->>'auth_source'))
  where feature_flags->>'auth_source' = 'event_quick_login';
