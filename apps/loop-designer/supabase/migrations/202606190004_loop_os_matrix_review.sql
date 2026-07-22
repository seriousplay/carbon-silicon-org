alter table public.loop_os_versions
  add column if not exists matrix_review jsonb;

comment on column public.loop_os_versions.matrix_review is 'Latest Matrix DesignStudy review snapshot for this Loop OS version';
