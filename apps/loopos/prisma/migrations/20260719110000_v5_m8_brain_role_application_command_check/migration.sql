ALTER TABLE "brain_command_operations"
  DROP CONSTRAINT "brain_command_operations_command_check";

ALTER TABLE "brain_command_operations"
  ADD CONSTRAINT "brain_command_operations_command_check" CHECK (
    "commandName" IN (
      'goal_proposal.create_draft',
      'goal_proposal.append_returned_revision',
      'goal_check_in.append',
      'tension.raise',
      'tactical_outcome.submit_proposal',
      'meeting_notes.update',
      'governance_proposal.create',
      'role_application.create'
    )
  );
