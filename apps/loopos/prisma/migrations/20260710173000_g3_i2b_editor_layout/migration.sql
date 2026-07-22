-- Editor geometry is stored separately so it never changes workflow semantic hashes.
ALTER TABLE "interface_workbenches"
ADD COLUMN "draftLayout" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "interface_workbench_versions"
ADD COLUMN "editorLayout" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "interface_workbench_versions"
ALTER COLUMN "editorLayout" DROP DEFAULT;
