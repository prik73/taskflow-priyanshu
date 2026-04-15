DROP INDEX IF EXISTS idx_tasks_creator_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS creator_id;
