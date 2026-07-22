REVOKE SELECT ON brain_read.current_actor FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.organization_identity FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.organization_brain_profile FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.current_actor_role_assignments FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.private_conversations FROM loopos_brain_reader;
REVOKE SELECT ON brain_read.private_messages FROM loopos_brain_reader;
REVOKE USAGE ON SCHEMA brain_read FROM loopos_brain_reader;
DROP SCHEMA brain_read CASCADE;
