-- creator_id tracks who created the task (separate from assignee_id).
-- Required by spec: "Delete task (project owner or task creator only)".
-- Nullable to allow back-filling existing rows; application layer enforces NOT NULL on new tasks.
ALTER TABLE tasks
  ADD COLUMN creator_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);
