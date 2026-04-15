// Package integration contains end-to-end tests that run against a real
// PostgreSQL database. They are skipped automatically when the environment
// variable INTEGRATION_DSN is not set, so they never block a plain `go test ./...`.
//
// Run locally:
//
//	INTEGRATION_DSN="postgres://taskflow:taskflow_password@localhost:5433/taskflow?sslmode=disable" \
//	JWT_SECRET=test-secret \
//	go test ./integration/... -v -count=1
package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/chi/v5"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"go.uber.org/zap"

	"taskflow/internal/auth"
	"taskflow/internal/db"
	"taskflow/internal/middleware"
	"taskflow/internal/project"
	"taskflow/internal/task"
	"taskflow/internal/user"
	"taskflow/migrations"
)

// ── Test server setup ─────────────────────────────────────────────────────────

type testEnv struct {
	server *httptest.Server
	client *http.Client
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()

	dsn := os.Getenv("INTEGRATION_DSN")
	if dsn == "" {
		t.Skip("INTEGRATION_DSN not set — skipping integration tests")
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "test-secret-for-integration"
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, dsn)
	if err != nil {
		t.Fatalf("connect to test db: %v", err)
	}
	t.Cleanup(pool.Close)

	// Run migrations
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		t.Fatalf("migration source: %v", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dsn)
	if err != nil {
		t.Fatalf("migrate init: %v", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		t.Fatalf("migrate up: %v", err)
	}
	m.Close()

	// Clean test data between runs (order matters due to FK constraints)
	t.Cleanup(func() {
		pool.Exec(ctx, "DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@integration.test')")
		pool.Exec(ctx, "DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE name LIKE 'integration-%')")
		pool.Exec(ctx, "DELETE FROM projects WHERE name LIKE 'integration-%'")
		pool.Exec(ctx, "DELETE FROM users WHERE email LIKE '%@integration.test'")
	})

	logger := zap.NewNop()

	// Wire dependencies
	userRepo    := user.NewRepository(pool)
	tokenRepo   := auth.NewTokenRepository(pool)
	projectRepo := project.NewRepository(pool)
	taskRepo    := task.NewRepository(pool)

	authService    := auth.NewService(userRepo, tokenRepo, jwtSecret)
	projectService := project.NewService(projectRepo)
	taskService    := task.NewService(taskRepo, projectRepo.GetOwnerID)

	authHandler    := auth.NewHandler(authService, logger)
	projectHandler := project.NewHandler(projectService, taskRepo, logger)
	taskHandler    := task.NewHandler(taskService, logger)
	userHandler    := user.NewHandler(userRepo, logger)

	r := chi.NewRouter()
	r.Use(chimiddleware.Recoverer)
	r.Use(cors.Handler(cors.Options{AllowedOrigins: []string{"*"}, AllowedMethods: []string{"GET", "POST", "PATCH", "DELETE"}, AllowedHeaders: []string{"Authorization", "Content-Type"}}))

	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
		r.Post("/refresh", authHandler.Refresh)
		r.Post("/logout", authHandler.Logout)
	})

	r.Group(func(r chi.Router) {
		r.Use(middleware.Authenticate(jwtSecret))
		r.Get("/users", userHandler.List)
		r.Route("/projects", func(r chi.Router) {
			r.Get("/", projectHandler.List)
			r.Post("/", projectHandler.Create)
			r.Get("/{id}", projectHandler.Get)
			r.Patch("/{id}", projectHandler.Update)
			r.Delete("/{id}", projectHandler.Delete)
			r.Get("/{id}/tasks", taskHandler.List)
			r.Post("/{id}/tasks", taskHandler.Create)
		})
		r.Route("/tasks", func(r chi.Router) {
			r.Patch("/{id}", taskHandler.Update)
			r.Delete("/{id}", taskHandler.Delete)
		})
	})

	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)

	return &testEnv{
		server: srv,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (e *testEnv) do(method, path string, body any, token string) *http.Response {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, e.server.URL+path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := e.client.Do(req)
	if err != nil {
		panic(fmt.Sprintf("http request failed: %v", err))
	}
	return resp
}

func decode(t *testing.T, resp *http.Response, dst any) {
	t.Helper()
	defer resp.Body.Close()
	if err := json.NewDecoder(resp.Body).Decode(dst); err != nil {
		t.Fatalf("decode response: %v", err)
	}
}

func uniqueEmail(prefix string) string {
	return fmt.Sprintf("%s-%d@integration.test", prefix, time.Now().UnixNano())
}

// ── Test 1: Auth — register, login, bad credentials ──────────────────────────

func TestAuth_RegisterAndLogin(t *testing.T) {
	e := newTestEnv(t)

	email := uniqueEmail("user")
	password := "securepassword123"

	// 1a. Register — should return 201 with tokens
	t.Run("register returns 201 with tokens", func(t *testing.T) {
		resp := e.do("POST", "/auth/register", map[string]string{
			"name": "Integration User", "email": email, "password": password,
		}, "")
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("want 201, got %d", resp.StatusCode)
		}
		var body map[string]any
		decode(t, resp, &body)
		if body["access_token"] == nil {
			t.Fatal("expected access_token in response")
		}
		if body["refresh_token"] == nil {
			t.Fatal("expected refresh_token in response")
		}
		u, ok := body["user"].(map[string]any)
		if !ok || u["email"] != email {
			t.Fatalf("expected user.email=%s, got %v", email, u)
		}
	})

	// 1b. Register duplicate email — should return 400
	t.Run("duplicate email returns 400", func(t *testing.T) {
		resp := e.do("POST", "/auth/register", map[string]string{
			"name": "Dup User", "email": email, "password": password,
		}, "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", resp.StatusCode)
		}
	})

	// 1c. Login with correct credentials — should return 200 with tokens
	t.Run("login with valid credentials returns 200", func(t *testing.T) {
		resp := e.do("POST", "/auth/login", map[string]string{
			"email": email, "password": password,
		}, "")
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("want 200, got %d", resp.StatusCode)
		}
		var body map[string]any
		decode(t, resp, &body)
		if body["access_token"] == nil {
			t.Fatal("expected access_token in response")
		}
	})

	// 1d. Login with wrong password — should return 401
	t.Run("login with wrong password returns 401", func(t *testing.T) {
		resp := e.do("POST", "/auth/login", map[string]string{
			"email": email, "password": "wrongpassword",
		}, "")
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", resp.StatusCode)
		}
	})

	// 1e. Protected route without token — should return 401
	t.Run("protected route without token returns 401", func(t *testing.T) {
		resp := e.do("GET", "/projects/", nil, "")
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", resp.StatusCode)
		}
	})

	// 1f. Register with missing fields — should return 400 with field errors
	t.Run("register with missing fields returns 400 with field errors", func(t *testing.T) {
		resp := e.do("POST", "/auth/register", map[string]string{
			"name": "", "email": "not-an-email", "password": "short",
		}, "")
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", resp.StatusCode)
		}
		var body map[string]any
		decode(t, resp, &body)
		fields, ok := body["fields"].(map[string]any)
		if !ok || len(fields) == 0 {
			t.Fatal("expected structured field errors")
		}
	})
}

// ── Test 2: Tasks — full CRUD lifecycle ──────────────────────────────────────

func TestTasks_FullLifecycle(t *testing.T) {
	e := newTestEnv(t)

	// Register and login a user
	email := uniqueEmail("taskowner")
	regResp := e.do("POST", "/auth/register", map[string]string{
		"name": "Task Owner", "email": email, "password": "testpassword123",
	}, "")
	if regResp.StatusCode != http.StatusCreated {
		t.Fatalf("setup: register failed with %d", regResp.StatusCode)
	}
	var authBody map[string]any
	decode(t, regResp, &authBody)
	token := authBody["access_token"].(string)

	// Create a project to put tasks in
	projResp := e.do("POST", "/projects/", map[string]string{
		"name": "integration-task-project", "description": "for task tests",
	}, token)
	if projResp.StatusCode != http.StatusCreated {
		t.Fatalf("setup: create project failed with %d", projResp.StatusCode)
	}
	var projBody map[string]any
	decode(t, projResp, &projBody)
	projectID := projBody["id"].(string)

	var taskID string

	// 2a. Create task
	t.Run("create task returns 201", func(t *testing.T) {
		resp := e.do("POST", "/projects/"+projectID+"/tasks", map[string]any{
			"title":    "integration-test task",
			"priority": "high",
			"due_date": "2026-12-31",
		}, token)
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("want 201, got %d", resp.StatusCode)
		}
		var body map[string]any
		decode(t, resp, &body)
		if body["id"] == nil {
			t.Fatal("expected task id in response")
		}
		taskID = body["id"].(string)
		if body["status"] != "todo" {
			t.Fatalf("expected default status=todo, got %v", body["status"])
		}
		if body["priority"] != "high" {
			t.Fatalf("expected priority=high, got %v", body["priority"])
		}
	})

	// 2b. Create task with missing title — should return 400
	t.Run("create task without title returns 400", func(t *testing.T) {
		resp := e.do("POST", "/projects/"+projectID+"/tasks", map[string]any{
			"priority": "low",
		}, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", resp.StatusCode)
		}
		var body map[string]any
		decode(t, resp, &body)
		fields, ok := body["fields"].(map[string]any)
		if !ok || fields["title"] == nil {
			t.Fatal("expected field error for title")
		}
	})

	// 2c. List tasks — should include the created task
	t.Run("list tasks returns created task", func(t *testing.T) {
		resp := e.do("GET", "/projects/"+projectID+"/tasks", nil, token)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("want 200, got %d", resp.StatusCode)
		}
		var body map[string]any
		decode(t, resp, &body)
		tasks := body["tasks"].([]any)
		if len(tasks) == 0 {
			t.Fatal("expected at least 1 task")
		}
	})

	// 2d. List tasks with status filter
	t.Run("list tasks filtered by status", func(t *testing.T) {
		resp := e.do("GET", "/projects/"+projectID+"/tasks?status=todo", nil, token)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("want 200, got %d", resp.StatusCode)
		}
		var body map[string]any
		decode(t, resp, &body)
		tasks := body["tasks"].([]any)
		if len(tasks) == 0 {
			t.Fatal("expected tasks with status=todo")
		}
	})

	// 2e. Filter with invalid status — should return 400
	t.Run("invalid status filter returns 400", func(t *testing.T) {
		resp := e.do("GET", "/projects/"+projectID+"/tasks?status=bogus", nil, token)
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("want 400, got %d", resp.StatusCode)
		}
	})

	// 2f. Update task status
	t.Run("update task status returns 200", func(t *testing.T) {
		resp := e.do("PATCH", "/tasks/"+taskID, map[string]string{
			"status": "in_progress",
		}, token)
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("want 200, got %d", resp.StatusCode)
		}
		var body map[string]any
		decode(t, resp, &body)
		if body["status"] != "in_progress" {
			t.Fatalf("expected status=in_progress, got %v", body["status"])
		}
	})

	// 2g. Delete task
	t.Run("delete task returns 204", func(t *testing.T) {
		resp := e.do("DELETE", "/tasks/"+taskID, nil, token)
		if resp.StatusCode != http.StatusNoContent {
			t.Fatalf("want 204, got %d", resp.StatusCode)
		}
		resp.Body.Close()
	})

	// 2h. Get deleted task — should return 404
	t.Run("deleted task returns 404 on update", func(t *testing.T) {
		resp := e.do("PATCH", "/tasks/"+taskID, map[string]string{"status": "todo"}, token)
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("want 404, got %d", resp.StatusCode)
		}
	})
}

// ── Test 3: Authorization — 401 vs 403, owner-only actions ───────────────────

func TestAuthorization(t *testing.T) {
	e := newTestEnv(t)

	// Create owner
	ownerEmail := uniqueEmail("owner")
	ownerResp := e.do("POST", "/auth/register", map[string]string{
		"name": "Owner", "email": ownerEmail, "password": "ownerpassword123",
	}, "")
	if ownerResp.StatusCode != http.StatusCreated {
		t.Fatalf("setup: owner register failed with %d", ownerResp.StatusCode)
	}
	var ownerAuth map[string]any
	decode(t, ownerResp, &ownerAuth)
	ownerToken := ownerAuth["access_token"].(string)

	// Create other user
	otherEmail := uniqueEmail("other")
	otherResp := e.do("POST", "/auth/register", map[string]string{
		"name": "Other", "email": otherEmail, "password": "otherpassword123",
	}, "")
	if otherResp.StatusCode != http.StatusCreated {
		t.Fatalf("setup: other register failed with %d", otherResp.StatusCode)
	}
	var otherAuth map[string]any
	decode(t, otherResp, &otherAuth)
	otherToken := otherAuth["access_token"].(string)

	// Owner creates a project
	projResp := e.do("POST", "/projects/", map[string]string{
		"name": "integration-auth-project",
	}, ownerToken)
	if projResp.StatusCode != http.StatusCreated {
		t.Fatalf("setup: create project failed with %d", projResp.StatusCode)
	}
	var projBody map[string]any
	decode(t, projResp, &projBody)
	projectID := projBody["id"].(string)

	// Owner creates a task
	taskResp := e.do("POST", "/projects/"+projectID+"/tasks", map[string]any{
		"title": "integration-auth-task", "priority": "low",
	}, ownerToken)
	if taskResp.StatusCode != http.StatusCreated {
		t.Fatalf("setup: create task failed with %d", taskResp.StatusCode)
	}
	var taskBody map[string]any
	decode(t, taskResp, &taskBody)
	taskID := taskBody["id"].(string)

	// 3a. No token → 401
	t.Run("no token returns 401", func(t *testing.T) {
		resp := e.do("GET", "/projects/", nil, "")
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", resp.StatusCode)
		}
		resp.Body.Close()
	})

	// 3b. Invalid token → 401
	t.Run("invalid token returns 401", func(t *testing.T) {
		resp := e.do("GET", "/projects/", nil, "not.a.valid.token")
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("want 401, got %d", resp.StatusCode)
		}
		resp.Body.Close()
	})

	// 3c. Other user tries to delete owner's project → 403
	t.Run("non-owner delete project returns 403", func(t *testing.T) {
		resp := e.do("DELETE", "/projects/"+projectID, nil, otherToken)
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("want 403, got %d", resp.StatusCode)
		}
		resp.Body.Close()
	})

	// 3d. Other user tries to update owner's project → 403
	t.Run("non-owner update project returns 403", func(t *testing.T) {
		resp := e.do("PATCH", "/projects/"+projectID, map[string]string{"name": "hijacked"}, otherToken)
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("want 403, got %d", resp.StatusCode)
		}
		resp.Body.Close()
	})

	// 3e. Other user tries to delete owner's task → 403
	t.Run("non-owner non-creator delete task returns 403", func(t *testing.T) {
		resp := e.do("DELETE", "/tasks/"+taskID, nil, otherToken)
		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("want 403, got %d", resp.StatusCode)
		}
		resp.Body.Close()
	})

	// 3f. Non-existent project → 404
	t.Run("non-existent project returns 404", func(t *testing.T) {
		resp := e.do("GET", "/projects/00000000-0000-0000-0000-000000000000", nil, ownerToken)
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("want 404, got %d", resp.StatusCode)
		}
		resp.Body.Close()
	})

	// 3g. Owner can delete their own project → 204
	t.Run("owner can delete their project", func(t *testing.T) {
		resp := e.do("DELETE", "/projects/"+projectID, nil, ownerToken)
		if resp.StatusCode != http.StatusNoContent {
			t.Fatalf("want 204, got %d", resp.StatusCode)
		}
		resp.Body.Close()
	})
}
