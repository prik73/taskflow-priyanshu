package task

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"taskflow/internal/middleware"
	"taskflow/internal/response"
	"taskflow/internal/sse"
)

// Handler serves all task-related routes.
type Handler struct {
	service *Service
	broker  *sse.Broker
	logger  *zap.Logger
}

func NewHandler(service *Service, broker *sse.Broker, logger *zap.Logger) *Handler {
	return &Handler{service: service, broker: broker, logger: logger}
}

// List godoc  GET /projects/:id/tasks
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	f := ListFilters{Page: 1, Limit: 20}
	if p, err := strconv.Atoi(r.URL.Query().Get("page")); err == nil && p > 0 {
		f.Page = p
	}
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		if l > 100 {
			l = 100 // cap at 100
		}
		f.Limit = l
	}
	if s := r.URL.Query().Get("status"); s != "" {
		if !IsValidStatus(s) {
			response.ValidationError(w, map[string]string{"status": "must be todo, in_progress, need_review, or resolved"})
			return
		}
		f.Status = &s
	}
	if a := r.URL.Query().Get("assignee"); a != "" {
		id, err := uuid.Parse(a)
		if err != nil {
			response.ValidationError(w, map[string]string{"assignee": "must be a valid UUID"})
			return
		}
		f.AssigneeID = &id
	}

	tasks, total, err := h.service.List(r.Context(), projectID, f)
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			response.NotFound(w)
			return
		}
		h.logger.Error("list tasks", zap.Error(err),
			zap.String("project_id", projectID.String()),
			zap.String("request_id", middleware.GetRequestID(r)),
		)
		response.InternalError(w)
		return
	}
	if tasks == nil {
		tasks = []*Task{}
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"tasks": tasks,
		"page":  f.Page,
		"limit": f.Limit,
		"total": total,
	})
}

// Create godoc  POST /projects/:id/tasks
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	var req struct {
		Title       string     `json:"title"`
		Description *string    `json:"description"`
		Priority    string     `json:"priority"`
		AssigneeID  *uuid.UUID `json:"assignee_id"`
		DueDate     *string    `json:"due_date"` // "YYYY-MM-DD"
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	fields := make(map[string]string)
	title := strings.TrimSpace(req.Title)
	if title == "" {
		fields["title"] = "is required"
	} else if len([]rune(title)) > 200 {
		fields["title"] = "must be 200 characters or fewer"
	}
	if req.Description != nil && len([]rune(*req.Description)) > 5000 {
		fields["description"] = "must be 5000 characters or fewer"
	}
	priority := Priority(req.Priority)
	if req.Priority == "" {
		priority = PriorityMedium
	} else if !IsValidPriority(req.Priority) {
		fields["priority"] = "must be low, medium, or high"
	}
	if len(fields) > 0 {
		response.ValidationError(w, fields)
		return
	}

	var dueDate *time.Time
	if req.DueDate != nil {
		d, err := time.Parse("2006-01-02", *req.DueDate)
		if err != nil {
			response.ValidationError(w, map[string]string{"due_date": "invalid date"})
			return
		}
		dueDate = &d
	}

	t, err := h.service.Create(r.Context(), CreateTaskInput{
		Title:       title,
		Description: req.Description,
		Priority:    priority,
		ProjectID:   projectID,
		AssigneeID:  req.AssigneeID,
		CreatorID:   claims.UserID,
		DueDate:     dueDate,
	})
	if err != nil {
		if errors.Is(err, ErrProjectNotFound) {
			response.NotFound(w)
			return
		}
		if errors.Is(err, ErrInvalidAssignee) {
			response.ValidationError(w, map[string]string{"assignee_id": "user does not exist"})
			return
		}
		h.logger.Error("create task", zap.Error(err),
			zap.String("project_id", projectID.String()),
			zap.String("user_id", claims.UserID.String()),
			zap.String("request_id", middleware.GetRequestID(r)),
		)
		response.InternalError(w)
		return
	}
	h.broker.Publish(t.ProjectID, sse.Event{
		Type:      sse.EventTaskCreated,
		ProjectID: t.ProjectID,
		Payload:   t,
	})
	response.JSON(w, http.StatusCreated, t)
}

// Update godoc  PATCH /tasks/:id
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	var req struct {
		Title         *string `json:"title"`
		Description   *string `json:"description"`
		Status        *string `json:"status"`
		Priority      *string `json:"priority"`
		AssigneeID    *string `json:"assignee_id"` // string to detect explicit null
		DueDate       *string `json:"due_date"`
		ClearAssignee bool    `json:"clear_assignee"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	fields := make(map[string]string)
	in := UpdateInput{}

	if req.Title != nil {
		trimmed := strings.TrimSpace(*req.Title)
		if trimmed == "" {
			fields["title"] = "cannot be empty"
		} else if len([]rune(trimmed)) > 200 {
			fields["title"] = "must be 200 characters or fewer"
		} else {
			in.Title = &trimmed
		}
	}
	if req.Description != nil {
		if len([]rune(*req.Description)) > 5000 {
			fields["description"] = "must be 5000 characters or fewer"
		} else {
			in.Description = req.Description
		}
	}
	if req.Status != nil {
		if !IsValidStatus(*req.Status) {
			fields["status"] = "must be todo, in_progress, need_review, or resolved"
		} else {
			s := Status(*req.Status)
			in.Status = &s
		}
	}
	if req.Priority != nil {
		if !IsValidPriority(*req.Priority) {
			fields["priority"] = "must be low, medium, or high"
		} else {
			p := Priority(*req.Priority)
			in.Priority = &p
		}
	}
	if req.ClearAssignee {
		in.ClearAssignee = true
	} else if req.AssigneeID != nil {
		aid, err := uuid.Parse(*req.AssigneeID)
		if err != nil {
			fields["assignee_id"] = "must be a valid UUID"
		} else {
			in.AssigneeID = &aid
		}
	}
	if req.DueDate != nil {
		d, err := time.Parse("2006-01-02", *req.DueDate)
		if err != nil {
			fields["due_date"] = "invalid date"
		} else {
			in.DueDate = &d
		}
	}
	if len(fields) > 0 {
		response.ValidationError(w, fields)
		return
	}

	t, err := h.service.Update(r.Context(), id, claims.UserID, in)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w)
			return
		}
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(w)
			return
		}
		h.logger.Error("update task", zap.Error(err),
			zap.String("task_id", id.String()),
			zap.String("user_id", claims.UserID.String()),
			zap.String("request_id", middleware.GetRequestID(r)),
		)
		response.InternalError(w)
		return
	}
	h.broker.Publish(t.ProjectID, sse.Event{
		Type:      sse.EventTaskUpdated,
		ProjectID: t.ProjectID,
		Payload:   t,
	})
	response.JSON(w, http.StatusOK, t)
}

// History godoc  GET /tasks/:id/history
func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	entries, err := h.service.GetHistory(r.Context(), taskID)
	if err != nil {
		h.logger.Error("get task history", zap.Error(err),
			zap.String("task_id", taskID.String()),
			zap.String("request_id", middleware.GetRequestID(r)),
		)
		response.InternalError(w)
		return
	}
	if entries == nil {
		entries = []*HistoryEntry{}
	}
	response.JSON(w, http.StatusOK, map[string]any{"history": entries})
}

// ProjectHistory godoc  GET /projects/:id/history?limit=15&offset=0
func (h *Handler) ProjectHistory(w http.ResponseWriter, r *http.Request) {
	projectID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	limit := 15
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	entries, err := h.service.GetProjectHistory(r.Context(), projectID, limit, offset)
	if err != nil {
		h.logger.Error("get project history", zap.Error(err),
			zap.String("project_id", projectID.String()),
			zap.String("request_id", middleware.GetRequestID(r)),
		)
		response.InternalError(w)
		return
	}
	if entries == nil {
		entries = []*ProjectHistoryEntry{}
	}
	response.JSON(w, http.StatusOK, map[string]any{
		"history":  entries,
		"limit":    limit,
		"offset":   offset,
		"has_more": len(entries) == limit,
	})
}

// Delete godoc  DELETE /tasks/:id
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.GetUserClaims(r)
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.NotFound(w)
		return
	}

	projectID, err := h.service.Delete(r.Context(), id, claims.UserID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(w)
			return
		}
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(w)
			return
		}
		h.logger.Error("delete task", zap.Error(err),
			zap.String("task_id", id.String()),
			zap.String("user_id", claims.UserID.String()),
			zap.String("request_id", middleware.GetRequestID(r)),
		)
		response.InternalError(w)
		return
	}
	h.broker.Publish(projectID, sse.Event{
		Type:      sse.EventTaskDeleted,
		ProjectID: projectID,
		Payload:   map[string]string{"id": id.String()},
	})
	w.WriteHeader(http.StatusNoContent)
}
