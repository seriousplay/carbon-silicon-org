BEGIN;

DO $loopos$
BEGIN
  IF EXISTS (SELECT 1 FROM "brain_command_operations" LIMIT 1) THEN
    RAISE EXCEPTION
      'refusing to roll back V5-M3-C while BrainCommandOperation ledger rows exist';
  END IF;
END
$loopos$;

DROP TRIGGER brain_command_operations_prevent_preview_mutation
  ON "brain_command_operations";
DROP FUNCTION brain_command_operations_prevent_preview_mutation();
DROP TABLE "brain_command_operations";
DROP TYPE "BrainCommandOperationStatus";

COMMIT;
