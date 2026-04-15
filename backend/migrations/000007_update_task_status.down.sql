ALTER TYPE task_status RENAME VALUE 'resolved' TO 'done';
-- Postgres cannot drop enum values; need_review stays but is unused after rollback.
