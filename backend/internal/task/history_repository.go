package task

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// HistoryEntry records a single change to a task field.
type HistoryEntry struct {
	ID        uuid.UUID  `json:"id"`
	TaskID    uuid.UUID  `json:"task_id"`
	UserID    *uuid.UUID `json:"user_id"`
	UserName  string     `json:"user_name"`
	Field     string     `json:"field"`
	OldValue  *string    `json:"old_value"`
	NewValue  *string    `json:"new_value"`
	CreatedAt time.Time  `json:"created_at"`
}

// HistoryRepository handles task_history database operations.
type HistoryRepository struct {
	db *pgxpool.Pool
}

// NewHistoryRepository constructs a HistoryRepository.
func NewHistoryRepository(pool *pgxpool.Pool) *HistoryRepository {
	return &HistoryRepository{db: pool}
}

// Insert bulk-inserts history entries. No-op if entries is empty.
func (r *HistoryRepository) Insert(ctx context.Context, entries []HistoryEntry) error {
	if len(entries) == 0 {
		return nil
	}

	for _, e := range entries {
		_, err := r.db.Exec(ctx, `
			INSERT INTO task_history (task_id, user_id, field, old_value, new_value)
			VALUES ($1, $2, $3, $4, $5)`,
			e.TaskID, e.UserID, e.Field, e.OldValue, e.NewValue,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// ListForTask returns the history for a given task, newest first, up to 100 entries.
func (r *HistoryRepository) ListForTask(ctx context.Context, taskID uuid.UUID) ([]*HistoryEntry, error) {
	rows, err := r.db.Query(ctx, `
		SELECT h.id, h.task_id, h.user_id, COALESCE(u.name, 'Deleted user') as user_name,
		       h.field, h.old_value, h.new_value, h.created_at
		FROM task_history h
		LEFT JOIN users u ON u.id = h.user_id
		WHERE h.task_id = $1
		ORDER BY h.created_at DESC
		LIMIT 100`,
		taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*HistoryEntry
	for rows.Next() {
		e := &HistoryEntry{}
		if err := rows.Scan(
			&e.ID, &e.TaskID, &e.UserID, &e.UserName,
			&e.Field, &e.OldValue, &e.NewValue, &e.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// ProjectHistoryEntry extends HistoryEntry with the task title for project-level feeds.
type ProjectHistoryEntry struct {
	HistoryEntry
	TaskTitle string `json:"task_title"`
}

// ListForProject returns paginated history entries across all tasks in a project, newest first.
func (r *HistoryRepository) ListForProject(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]*ProjectHistoryEntry, error) {
	rows, err := r.db.Query(ctx, `
		SELECT h.id, h.task_id, h.user_id, COALESCE(u.name, 'Deleted user') as user_name,
		       h.field, h.old_value, h.new_value, h.created_at, t.title as task_title
		FROM task_history h
		LEFT JOIN users u ON u.id = h.user_id
		JOIN tasks t ON t.id = h.task_id
		WHERE t.project_id = $1
		ORDER BY h.created_at DESC
		LIMIT $2 OFFSET $3`,
		projectID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*ProjectHistoryEntry
	for rows.Next() {
		e := &ProjectHistoryEntry{}
		if err := rows.Scan(
			&e.ID, &e.TaskID, &e.UserID, &e.UserName,
			&e.Field, &e.OldValue, &e.NewValue, &e.CreatedAt, &e.TaskTitle,
		); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
