package middleware

import (
	"net/http"
	"time"

	"go.uber.org/zap"
)

// statusRecorder wraps ResponseWriter to capture the HTTP status code and bytes written.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (sr *statusRecorder) WriteHeader(status int) {
	sr.status = status
	sr.ResponseWriter.WriteHeader(status)
}

func (sr *statusRecorder) Write(b []byte) (int, error) {
	n, err := sr.ResponseWriter.Write(b)
	sr.bytes += n
	return n, err
}

// Flush forwards to the underlying ResponseWriter if it supports http.Flusher.
// This is required for SSE (text/event-stream) streaming to work correctly.
func (sr *statusRecorder) Flush() {
	if f, ok := sr.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Logger returns a structured zap request-logging middleware.
func Logger(logger *zap.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sr := &statusRecorder{ResponseWriter: w, status: http.StatusOK}

			next.ServeHTTP(sr, r)

			// Skip logging SSE streams — they're long-lived and noisy
			if r.Header.Get("Accept") == "text/event-stream" {
				return
			}

			fields := []zap.Field{
				zap.String("request_id", GetRequestID(r)),
				zap.String("method", r.Method),
				zap.String("path", r.URL.Path),
				zap.Int("status", sr.status),
				zap.Duration("duration", time.Since(start)),
				zap.Int("bytes", sr.bytes),
			}
			// Only include query string when present
			if q := r.URL.RawQuery; q != "" {
				fields = append(fields, zap.String("query", q))
			}
			// Include user identity when available
			if claims := GetUserClaims(r); claims != nil {
				fields = append(fields, zap.String("user_id", claims.UserID.String()))
			}

			switch {
			case sr.status >= 500:
				logger.Error("http_request", fields...)
			case sr.status >= 400:
				logger.Warn("http_request", fields...)
			default:
				logger.Info("http_request", fields...)
			}
		})
	}
}
