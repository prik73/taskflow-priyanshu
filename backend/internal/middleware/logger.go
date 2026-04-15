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

			logger.Info("http_request",
				zap.String("request_id", GetRequestID(r)),
				zap.String("method", r.Method),
				zap.String("path", r.URL.Path),
				zap.String("query", r.URL.RawQuery),
				zap.Int("status", sr.status),
				zap.Duration("duration", time.Since(start)),
				zap.Int("bytes", sr.bytes),
				zap.String("remote_addr", r.RemoteAddr),
				zap.String("user_agent", r.UserAgent()),
			)
		})
	}
}
