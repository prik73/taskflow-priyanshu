package response

import (
	"encoding/json"
	"net/http"
)

// ErrorBody is the standard error response shape.
type ErrorBody struct {
	Error  string            `json:"error"`
	Fields map[string]string `json:"fields,omitempty"`
}

// JSON writes a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// Error writes a plain error string as JSON.
func Error(w http.ResponseWriter, status int, msg string) {
	JSON(w, status, ErrorBody{Error: msg})
}

// ValidationError writes a 400 with field-level errors.
func ValidationError(w http.ResponseWriter, fields map[string]string) {
	JSON(w, http.StatusBadRequest, ErrorBody{
		Error:  "validation failed",
		Fields: fields,
	})
}

// NotFound writes a 404 not found response.
func NotFound(w http.ResponseWriter) {
	Error(w, http.StatusNotFound, "not found")
}

// Unauthorized writes a 401 response.
func Unauthorized(w http.ResponseWriter) {
	Error(w, http.StatusUnauthorized, "unauthorized")
}

// Forbidden writes a 403 response.
func Forbidden(w http.ResponseWriter) {
	Error(w, http.StatusForbidden, "forbidden")
}

// InternalError writes a 500 response without leaking internals.
func InternalError(w http.ResponseWriter) {
	Error(w, http.StatusInternalServerError, "internal server error")
}
