-- Rename 'done' → 'resolved' and add 'need_review'
-- Postgres doesn't support renaming enum values directly before 10,
-- but ALTER TYPE ... RENAME VALUE is available since PG 10.
ALTER TYPE task_status RENAME VALUE 'done' TO 'resolved';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'need_review';
