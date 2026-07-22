alter table public.loop_designer_sessions
  add column if not exists matrix_integration jsonb;
