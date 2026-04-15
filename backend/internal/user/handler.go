package user

import (
	"net/http"

	"go.uber.org/zap"

	"taskflow/internal/response"
)

type Handler struct {
	repo   *Repository
	logger *zap.Logger
}

func NewHandler(repo *Repository, logger *zap.Logger) *Handler {
	return &Handler{repo: repo, logger: logger}
}

// List godoc  GET /users
// Returns all registered users (id, name, email only — no password).
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.ListAll(r.Context())
	if err != nil {
		h.logger.Error("list users", zap.Error(err))
		response.InternalError(w)
		return
	}
	if users == nil {
		users = []*User{}
	}
	response.JSON(w, http.StatusOK, map[string]any{"users": users})
}
