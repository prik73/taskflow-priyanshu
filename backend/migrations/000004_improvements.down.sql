ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_email_format;
DROP INDEX IF EXISTS idx_tasks_assignee_project;
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
ALTER TABLE projects DROP COLUMN IF EXISTS updated_at;
DROP FUNCTION IF EXISTS set_updated_at();
