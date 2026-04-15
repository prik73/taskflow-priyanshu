-- Reusable trigger function for auto-updating updated_at columns
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at to projects (was missing)
ALTER TABLE projects ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger for tasks (so Go code doesn't have to manage it manually)
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Composite index: covers the assignee_id filter + join on project_id in ListForUser
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_project ON tasks(assignee_id, project_id);

-- Email format check constraint
ALTER TABLE users ADD CONSTRAINT chk_users_email_format
  CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
