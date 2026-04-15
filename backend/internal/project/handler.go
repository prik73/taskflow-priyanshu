package project

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"taskflow/internal/middleware"
	"taskflow/internal/response"
	"taskflow/internal/task"
)

// Handler serves all /projects routes.
type Handler struct {
	service  *Service
	taskRepo *task.Repository
	logger   *zap.Logger
}

func NewHandler(service *Service, taskRepo *task.Repository, logger *zap.Logger) *Handler {
	return &Handler{service: service, taskRepo: taskRepo, logger: logger}
}

// List godoc  GET /projects
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, limit := parsePagination(r)

	projects, total, err := h.service.ListAll(r.Context(), page, limit)
	if err != nil {
		h.logger.Error("list projects", zap.Error(err))
		response.InternalError(w)
		return
	}
	if projects == nil {
		projects = []*Project{}
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"projects": projects,
		"page":     page,
		"limit":    limit,
		"total":    total,
	})
}

// Create godoc  POST /projects
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)

	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	fields := make(map[string]string)
	name := strings.TrimSpace(req.Name)
	if name == "" {
		fields["name"] = "is required"
	} else if len([]rune(name)) > 200 {
		fields["name"] = "must be 200 characters or fewer"
	}
	if req.Description != nil && len([]rune(*req.Description)) > 2000 {
		fields["description"] = "must be 2000 characters or fewer"
	}
	if len(fields) > 0 {
		response.ValidationError(w, fields)
		return
	}

	p, err := h.service.Create(r.Context(), name, req.Description, claims.UserID)
	if err != nil {
		h.logger.Error("create project", zap.Error(err))
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusCreated, p)
}

// Get godoc  GET /projects/:id
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	p, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w)
			return
		}
		h.logger.Error("get project", zap.Error(err))
		response.InternalError(w)
		return
	}

	tasks, err := h.taskRepo.ListByProject(r.Context(), id)
	if err != nil {
		h.logger.Error("get project tasks", zap.Error(err))
		response.InternalError(w)
		return
	}
	if tasks == nil {
		tasks = []*task.Task{}
	}

	response.JSON(w, http.StatusOK, map[string]any{
		"id":          p.ID,
		"name":        p.Name,
		"description": p.Description,
		"owner_id":    p.OwnerID,
		"created_at":  p.CreatedAt,
		"updated_at":  p.UpdatedAt,
		"tasks":       tasks,
	})
}

// Update godoc  PATCH /projects/:id
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	// Fetch current to use as defaults for partial update
	current, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w)
			return
		}
		h.logger.Error("get project for update", zap.Error(err))
		response.InternalError(w)
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Apply patch semantics — only update provided fields
	fields := make(map[string]string)
	name := current.Name
	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		if trimmed == "" {
			fields["name"] = "cannot be empty"
		} else if len([]rune(trimmed)) > 200 {
			fields["name"] = "must be 200 characters or fewer"
		} else {
			name = trimmed
		}
	}
	description := current.Description
	if req.Description != nil {
		if len([]rune(*req.Description)) > 2000 {
			fields["description"] = "must be 2000 characters or fewer"
		} else {
			description = req.Description
		}
	}
	if len(fields) > 0 {
		response.ValidationError(w, fields)
		return
	}

	p, err := h.service.Update(r.Context(), id, claims.UserID, name, description)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w)
			return
		}
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(w)
			return
		}
		h.logger.Error("update project", zap.Error(err))
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, p)
}

// Delete godoc  DELETE /projects/:id
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	if err := h.service.Delete(r.Context(), id, claims.UserID); err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w)
			return
		}
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(w)
			return
		}
		h.logger.Error("delete project", zap.Error(err))
		response.InternalError(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Stats godoc  GET /projects/:id/stats  (bonus)
func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	stats, err := h.service.GetStats(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w)
			return
		}
		h.logger.Error("get project stats", zap.Error(err))
		response.InternalError(w)
		return
	}
	response.JSON(w, http.StatusOK, stats)
}

// --- helpers ---

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

func parsePagination(r *http.Request) (page, limit int) {
	page = 1
	limit = 20
	if p, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && p > 0 {
		page = p
	}
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		if l > 100 {
			l = 100 // cap at 100
		}
		limit = l
	}
	return
}
