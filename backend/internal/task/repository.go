package task

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound        = errors.New("task not found")
	ErrInvalidAssignee = errors.New("assignee user does not exist")
)

// isFKViolation returns true if err is a PostgreSQL foreign-key violation (SQLSTATE 23503).
func isFKViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

// Repository handles all task database operations.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ListFilters holds optional filter parameters for task listing.
type ListFilters struct {
	Status     *string
	AssigneeID *uuid.UUID
	Page       int
	Limit      int
}

const taskSelectCols = `
	id, title, description, status, priority,
	project_id, assignee_id, creator_id, due_date, created_at, updated_at`

func scanTask(row pgx.Row) (*Task, error) {
	t := &Task{}
	err := row.Scan(
		&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.AssigneeID, &t.CreatorID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// List returns tasks for a project with optional filters, pagination, and a total count.
func (r *Repository) List(ctx context.Context, projectID uuid.UUID, f ListFilters) ([]*Task, int64, error) {
	offset := (f.Page - 1) * f.Limit

	where := "WHERE project_id = $1"
	args := []any{projectID}
	i := 2

	if f.Status != nil {
		where += fmt.Sprintf(" AND status = $%d::task_status", i)
		args = append(args, *f.Status)
		i++
	}
	if f.AssigneeID != nil {
		where += fmt.Sprintf(" AND assignee_id = $%d", i)
		args = append(args, *f.AssigneeID)
		i++
	}

	// Run count + list in parallel using pgxpool
	type countResult struct {
		total int64
		err   error
	}
	countCh := make(chan countResult, 1)
	go func() {
		var total int64
		err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM tasks "+where, args[:i-1]...).Scan(&total)
		countCh <- countResult{total, err}
	}()

	query := "SELECT " + taskSelectCols + " FROM tasks " + where +
		fmt.Sprintf(" ORDER BY updated_at DESC LIMIT $%d OFFSET $%d", i, i+1)
	listArgs := append(args, f.Limit, offset)

	rows, err := r.db.Query(ctx, query, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []*Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, t)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	cr := <-countCh
	if cr.err != nil {
		return nil, 0, cr.err
	}

	return out, cr.total, nil
}

// ListByProject returns all tasks for a project without filters (used by project detail endpoint).
func (r *Repository) ListByProject(ctx context.Context, projectID uuid.UUID) ([]*Task, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+taskSelectCols+` FROM tasks WHERE project_id = $1 ORDER BY updated_at DESC`,
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// CreateInput holds all fields needed to create a task.
type CreateInput struct {
	Title       string
	Description *string
	Priority    Priority
	ProjectID   uuid.UUID
	AssigneeID  *uuid.UUID
	CreatorID   uuid.UUID
	DueDate     *time.Time
}

// Create inserts a new task.
func (r *Repository) Create(ctx context.Context, in CreateInput) (*Task, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO tasks (title, description, priority, project_id, assignee_id, creator_id, due_date)
		VALUES ($1, $2, $3::task_priority, $4, $5, $6, $7)
		RETURNING `+taskSelectCols,
		in.Title, in.Description, string(in.Priority), in.ProjectID, in.AssigneeID, in.CreatorID, in.DueDate,
	)
	t, err := scanTask(row)
	if err != nil {
		if isFKViolation(err) {
			return nil, ErrInvalidAssignee
		}
		return nil, err
	}
	return t, nil
}

// FindByID retrieves a single task by primary key.
func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*Task, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+taskSelectCols+` FROM tasks WHERE id = $1`, id,
	)
	t, err := scanTask(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

// UpdateInput holds optional fields for a task PATCH operation.
type UpdateInput struct {
	Title         *string
	Description   *string
	Status        *Status
	Priority      *Priority
	AssigneeID    *uuid.UUID
	ClearAssignee bool // set assignee_id = NULL
	DueDate       *time.Time
}

// Update performs a safe dynamic partial update.
// updated_at is handled automatically by the DB trigger (migration 004).
func (r *Repository) Update(ctx context.Context, id uuid.UUID, in UpdateInput) (*Task, error) {
	setClauses := []string{}
	args := []any{}
	idx := 1

	if in.Title != nil {
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", idx))
		args = append(args, *in.Title)
		idx++
	}
	if in.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", idx))
		args = append(args, *in.Description)
		idx++
	}
	if in.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d::task_status", idx))
		args = append(args, string(*in.Status))
		idx++
	}
	if in.Priority != nil {
		setClauses = append(setClauses, fmt.Sprintf("priority = $%d::task_priority", idx))
		args = append(args, string(*in.Priority))
		idx++
	}
	if in.ClearAssignee {
		setClauses = append(setClauses, "assignee_id = NULL")
	} else if in.AssigneeID != nil {
		setClauses = append(setClauses, fmt.Sprintf("assignee_id = $%d", idx))
		args = append(args, *in.AssigneeID)
		idx++
	}
	if in.DueDate != nil {
		setClauses = append(setClauses, fmt.Sprintf("due_date = $%d", idx))
		args = append(args, *in.DueDate)
		idx++
	}

	// Nothing to update — still return current state
	if len(setClauses) == 0 {
		return r.FindByID(ctx, id)
	}

	query := fmt.Sprintf(
		`UPDATE tasks SET %s WHERE id = $%d RETURNING %s`,
		strings.Join(setClauses, ", "), idx, taskSelectCols,
	)
	args = append(args, id)

	row := r.db.QueryRow(ctx, query, args...)
	t, err := scanTask(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

// Delete removes a task by ID.
func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
