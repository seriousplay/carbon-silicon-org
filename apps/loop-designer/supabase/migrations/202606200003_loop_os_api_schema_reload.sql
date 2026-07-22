-- Ensure PostgREST sees the Loop OS v1 tables after the migration chain runs.
-- Without this, the API can keep returning PGRST205 until the schema cache reloads.

select pg_notify('pgrst', 'reload schema');
