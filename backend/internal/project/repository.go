package project

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("project not found")

// Repository handles all project database operations.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const projectSelectCols = `id, name, description, owner_id, created_at, updated_at`

func scanProject(row pgx.Row) (*Project, error) {
	p := &Project{}
	err := row.Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// ListAll returns all projects visible to any authenticated user, ordered newest first.
func (r *Repository) ListAll(ctx context.Context, page, limit int) ([]*Project, int64, error) {
	offset := (page - 1) * limit

	type countResult struct {
		total int64
		err   error
	}
	countCh := make(chan countResult, 1)
	go func() {
		var total int64
		err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM projects`).Scan(&total)
		countCh <- countResult{total, err}
	}()

	rows, err := r.db.Query(ctx,
		`SELECT `+projectSelectCols+` FROM projects ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []*Project
	for rows.Next() {
		p := &Project{}
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, p)
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

// Create inserts a new project owned by ownerID.
func (r *Repository) Create(ctx context.Context, name string, description *string, ownerID uuid.UUID) (*Project, error) {
	row := r.db.QueryRow(ctx, `
		INSERT INTO projects (name, description, owner_id)
		VALUES ($1, $2, $3)
		RETURNING `+projectSelectCols,
		name, description, ownerID,
	)
	return scanProject(row)
}

// FindByID retrieves a project by its primary key.
func (r *Repository) FindByID(ctx context.Context, id uuid.UUID) (*Project, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+projectSelectCols+` FROM projects WHERE id = $1`, id,
	)
	p, err := scanProject(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return p, nil
}

// GetOwnerID returns just the owner_id for a project — used by task.Service to avoid import cycles.
func (r *Repository) GetOwnerID(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	var ownerID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT owner_id FROM projects WHERE id = $1`, id).Scan(&ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrNotFound
		}
		return uuid.Nil, err
	}
	return ownerID, nil
}

// Update patches name and description on an existing project.
func (r *Repository) Update(ctx context.Context, id uuid.UUID, name string, description *string) (*Project, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE projects
		SET name = $2, description = $3
		WHERE id = $1
		RETURNING `+projectSelectCols,
		id, name, description,
	)
	p, err := scanProject(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return p, nil
}

// Delete removes a project (tasks cascade via FK).
func (r *Repository) Delete(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetStats returns task counts grouped by status and by assignee for a project.
func (r *Repository) GetStats(ctx context.Context, projectID uuid.UUID) (*Stats, error) {
	stats := &Stats{
		ByStatus:   []StatusStat{},
		ByAssignee: []AssigneeStat{},
	}

	// --- by status ---
	rows, err := r.db.Query(ctx, `
		SELECT status::text, COUNT(*)
		FROM tasks WHERE project_id = $1
		GROUP BY status
		ORDER BY status
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var s StatusStat
		if err := rows.Scan(&s.Status, &s.Count); err != nil {
			return nil, err
		}
		stats.ByStatus = append(stats.ByStatus, s)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// --- by assignee ---
	rows2, err := r.db.Query(ctx, `
		SELECT t.assignee_id, u.name, COUNT(*)
		FROM tasks t
		LEFT JOIN users u ON u.id = t.assignee_id
		WHERE t.project_id = $1
		GROUP BY t.assignee_id, u.name
		ORDER BY COUNT(*) DESC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var a AssigneeStat
		if err := rows2.Scan(&a.AssigneeID, &a.AssigneeName, &a.Count); err != nil {
			return nil, err
		}
		stats.ByAssignee = append(stats.ByAssignee, a)
	}
	return stats, rows2.Err()
}
