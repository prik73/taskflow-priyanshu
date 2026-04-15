// cmd/seed/main.go — populates the database with demo data for reviewers.
// Idempotent: safe to run multiple times (uses ON CONFLICT DO NOTHING / DO UPDATE).
//
// Usage:
//
//	go run ./cmd/seed
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"taskflow/internal/config"
	"taskflow/internal/db"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := seed(ctx, pool); err != nil {
		log.Fatalf("seed: %v", err)
	}

	fmt.Fprintln(os.Stdout, "")
	fmt.Fprintln(os.Stdout, "✅  Seed data inserted successfully")
	fmt.Fprintln(os.Stdout, "")
	fmt.Fprintln(os.Stdout, "   Primary test credentials:")
	fmt.Fprintln(os.Stdout, "     Email:    test@example.com")
	fmt.Fprintln(os.Stdout, "     Password: password123")
	fmt.Fprintln(os.Stdout, "")
	fmt.Fprintln(os.Stdout, "   Secondary user (for assignee testing):")
	fmt.Fprintln(os.Stdout, "     Email:    bob@example.com")
	fmt.Fprintln(os.Stdout, "     Password: password123")
}

func seed(ctx context.Context, pool *pgxpool.Pool) error {
	hash, err := bcrypt.GenerateFromPassword([]byte("password123"), 12)
	if err != nil {
		return fmt.Errorf("bcrypt: %w", err)
	}
	passwordHash := string(hash)

	// ── User 1: Alice (primary test user, project owner) ─────────────────────
	var aliceID uuid.UUID
	err = pool.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash)
		VALUES ('Alice (Test User)', 'test@example.com', $1)
		ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
		RETURNING id
	`, passwordHash).Scan(&aliceID)
	if err != nil {
		return fmt.Errorf("upsert alice: %w", err)
	}
	fmt.Printf("  👤 Alice: %s\n", aliceID)

	// ── User 2: Bob (for assignee demos) ──────────────────────────────────────
	var bobID uuid.UUID
	err = pool.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash)
		VALUES ('Bob (Reviewer)', 'bob@example.com', $1)
		ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
		RETURNING id
	`, passwordHash).Scan(&bobID)
	if err != nil {
		return fmt.Errorf("upsert bob: %w", err)
	}
	fmt.Printf("  👤 Bob:   %s\n", bobID)

	// ── Project owned by Alice ────────────────────────────────────────────────
	var projectID uuid.UUID
	err = pool.QueryRow(ctx, `
		INSERT INTO projects (name, description, owner_id)
		VALUES ('Website Redesign', 'Q2 redesign — homepage, navigation, and testing', $1)
		ON CONFLICT DO NOTHING
		RETURNING id
	`, aliceID).Scan(&projectID)
	if err != nil || projectID == uuid.Nil {
		if scanErr := pool.QueryRow(ctx,
			`SELECT id FROM projects WHERE owner_id = $1 ORDER BY created_at LIMIT 1`,
			aliceID,
		).Scan(&projectID); scanErr != nil {
			return fmt.Errorf("fetch seed project: %w", scanErr)
		}
	}
	fmt.Printf("  📁 Project: %s\n", projectID)

	// ── 3 tasks with different statuses ──────────────────────────────────────
	type taskDef struct {
		title      string
		status     string
		priority   string
		assigneeID *uuid.UUID
		creatorID  uuid.UUID
		dueDate    *string
	}

	due := "2026-05-15"
	tasks := []taskDef{
		// todo — high priority, assigned to Bob, due soon
		{
			title:      "Design homepage mockup",
			status:     "todo",
			priority:   "high",
			assigneeID: &bobID,
			creatorID:  aliceID,
			dueDate:    &due,
		},
		// in_progress — medium, Alice working on it
		{
			title:      "Implement navigation bar",
			status:     "in_progress",
			priority:   "medium",
			assigneeID: &aliceID,
			creatorID:  aliceID,
		},
		// done — low priority, created by Bob
		{
			title:      "Write unit tests",
			status:     "resolved",
			priority:   "low",
			assigneeID: nil,
			creatorID:  bobID,
		},
	}

	for _, t := range tasks {
		_, err := pool.Exec(ctx, `
			INSERT INTO tasks (title, status, priority, project_id, assignee_id, creator_id, due_date)
			VALUES ($1, $2::task_status, $3::task_priority, $4, $5, $6, $7::date)
			ON CONFLICT DO NOTHING
		`, t.title, t.status, t.priority, projectID, t.assigneeID, t.creatorID, t.dueDate)
		if err != nil {
			return fmt.Errorf("insert task %q: %w", t.title, err)
		}
		fmt.Printf("  ✓ Task [%-11s] %q\n", t.status, t.title)
	}

	return nil
}
