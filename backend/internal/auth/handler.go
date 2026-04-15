package auth

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"go.uber.org/zap"

	"taskflow/internal/response"
)

var emailRE = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// Handler exposes auth routes: register, login, refresh, logout.
type Handler struct {
	service *Service
	logger  *zap.Logger
}

func NewHandler(service *Service, logger *zap.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

// Register godoc
// POST /auth/register
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	fields := make(map[string]string)
	name := strings.TrimSpace(req.Name)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if name == "" {
		fields["name"] = "is required"
	} else if len(name) > 100 {
		fields["name"] = "must be 100 characters or fewer"
	}
	if email == "" {
		fields["email"] = "is required"
	} else if len(email) > 254 {
		fields["email"] = "must be 254 characters or fewer"
	} else if !emailRE.MatchString(email) {
		fields["email"] = "must be a valid email address"
	}
	if len(req.Password) < 8 {
		fields["password"] = "must be at least 8 characters"
	} else if len(req.Password) > 72 {
		// bcrypt silently truncates at 72 bytes — reject rather than silently truncate
		fields["password"] = "must be 72 characters or fewer"
	}
	if len(fields) > 0 {
		response.ValidationError(w, fields)
		return
	}

	result, err := h.service.Register(r.Context(), RegisterInput{
		Name:     name,
		Email:    email,
		Password: req.Password,
	})
	if err != nil {
		if errors.Is(err, ErrEmailTaken) {
			response.ValidationError(w, map[string]string{"email": "already in use"})
			return
		}
		h.logger.Error("register failed", zap.Error(err))
		response.InternalError(w)
		return
	}

	response.JSON(w, http.StatusCreated, result)
}

// Login godoc
// POST /auth/login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	fields := make(map[string]string)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		fields["email"] = "is required"
	} else if !emailRE.MatchString(email) {
		fields["email"] = "must be a valid email address"
	}
	if req.Password == "" {
		fields["password"] = "is required"
	}
	if len(fields) > 0 {
		response.ValidationError(w, fields)
		return
	}

	result, err := h.service.Login(r.Context(), LoginInput{
		Email:    email,
		Password: req.Password,
	})
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			response.Error(w, http.StatusUnauthorized, "invalid email or password")
			return
		}
		h.logger.Error("login failed", zap.Error(err))
		response.InternalError(w)
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// Refresh godoc
// POST /auth/refresh — exchanges a refresh token for a new access token + rotated refresh token
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.RefreshToken) == "" {
		response.ValidationError(w, map[string]string{"refresh_token": "is required"})
		return
	}

	result, err := h.service.Refresh(r.Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			response.Error(w, http.StatusUnauthorized, "invalid or expired refresh token")
			return
		}
		h.logger.Error("refresh failed", zap.Error(err))
		response.InternalError(w)
		return
	}

	response.JSON(w, http.StatusOK, result)
}

// Logout godoc
// POST /auth/logout — revokes the provided refresh token (access token expires naturally)
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.service.Logout(r.Context(), strings.TrimSpace(req.RefreshToken)); err != nil {
		h.logger.Error("logout failed", zap.Error(err))
		response.InternalError(w)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
