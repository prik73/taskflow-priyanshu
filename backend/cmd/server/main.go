// cmd/server/main.go — TaskFlow API server entrypoint.
// Bootstraps config → DB → migrations → router → graceful shutdown.
package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/go-chi/cors"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"go.uber.org/zap"

	"taskflow/internal/auth"
	"taskflow/internal/config"
	"taskflow/internal/db"
	"taskflow/internal/middleware"
	"taskflow/internal/project"
	"taskflow/internal/sse"
	"taskflow/internal/task"
	"taskflow/internal/user"
	"taskflow/migrations"
)

func main() {
	// ── Config ──────────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		// Logger isn't ready yet; use stdlib
		panic("config: " + err.Error())
	}

	// ── Logger ──────────────────────────────────────────────────────────────
	var logger *zap.Logger
	if cfg.Env == "production" {
		logger, err = zap.NewProduction()
	} else {
		logger, err = zap.NewDevelopment()
	}
	if err != nil {
		panic("logger: " + err.Error())
	}
	defer logger.Sync() //nolint:errcheck

	// ── Database ─────────────────────────────────────────────────────────────
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("db connect", zap.Error(err))
	}
	defer pool.Close()
	logger.Info("database connected")

	// ── Migrations ───────────────────────────────────────────────────────────
	if err := runMigrations(cfg.DatabaseURL, logger); err != nil {
		logger.Fatal("migrations failed", zap.Error(err))
	}

	// ── Wire dependencies ─────────────────────────────────────────────────────
	// Repos
	userRepo    := user.NewRepository(pool)
	tokenRepo   := auth.NewTokenRepository(pool)
	projectRepo := project.NewRepository(pool)
	taskRepo    := task.NewRepository(pool)

	// Services
	authService    := auth.NewService(userRepo, tokenRepo, cfg.JWTSecret)
	projectService := project.NewService(projectRepo)
	// Inject project owner lookup as a closure to break the import cycle
	taskService := task.NewService(taskRepo, projectRepo.GetOwnerID)

	// SSE broker — shared between task handler (publishes) and SSE route (subscribes)
	broker := sse.NewBroker()

	// Handlers
	authHandler    := auth.NewHandler(authService, logger)
	projectHandler := project.NewHandler(projectService, taskRepo, logger)
	taskHandler    := task.NewHandler(taskService, broker, logger)
	userHandler    := user.NewHandler(userRepo, logger)

	// ── Router ───────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.Logger(logger))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// Limit request bodies to 1 MB — prevents DoS via oversized JSON payloads.
	r.Use(chimiddleware.RequestSize(1 << 20)) // 1 MiB

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`)) //nolint:errcheck
	})

	// Auth routes (public)
	r.Route("/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
		r.Post("/refresh", authHandler.Refresh)
		r.Post("/logout", authHandler.Logout)
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Authenticate(cfg.JWTSecret))

		// Projects
		r.Route("/projects", func(r chi.Router) {
			r.Get("/", projectHandler.List)
			r.Post("/", projectHandler.Create)
			r.Get("/{id}", projectHandler.Get)
			r.Patch("/{id}", projectHandler.Update)
			r.Delete("/{id}", projectHandler.Delete)
			r.Get("/{id}/stats", projectHandler.Stats)

			// Tasks nested under project
			r.Get("/{id}/tasks", taskHandler.List)
			r.Post("/{id}/tasks", taskHandler.Create)

			// SSE stream for real-time task events
			r.Get("/{id}/events", func(w http.ResponseWriter, r *http.Request) {
				projectID, err := uuid.Parse(chi.URLParam(r, "id"))
				if err != nil {
					http.Error(w, "invalid project id", http.StatusBadRequest)
					return
				}
				broker.ServeProject(projectID, w, r)
			})
		})

		// Task operations by task ID
		r.Route("/tasks", func(r chi.Router) {
			r.Patch("/{id}", taskHandler.Update)
			r.Delete("/{id}", taskHandler.Delete)
		})

		// Users — for assignee picker
		r.Get("/users", userHandler.List)
	})

	// ── HTTP server with graceful shutdown ────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Listen for OS signals in background
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		logger.Info("server starting", zap.String("addr", srv.Addr), zap.String("env", cfg.Env))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	<-quit
	logger.Info("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", zap.Error(err))
	} else {
		logger.Info("server stopped cleanly")
	}
}

// runMigrations applies all pending up migrations using the embedded SQL files.
func runMigrations(databaseURL string, logger *zap.Logger) error {
	src, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return err
	}

	m, err := migrate.NewWithSourceInstance("iofs", src, databaseURL)
	if err != nil {
		return err
	}
	defer m.Close()

	if err := m.Up(); err != nil {
		if errors.Is(err, migrate.ErrNoChange) {
			logger.Info("migrations: no new migrations")
			return nil
		}
		return err
	}

	logger.Info("migrations: applied successfully")
	return nil
}
