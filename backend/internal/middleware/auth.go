package middleware

import (
	"context"
	"net/http"
	"strings"

	"taskflow/internal/auth"
	"taskflow/internal/response"
)

type contextKey string

const userClaimsKey contextKey = "user_claims"

// Authenticate validates the Bearer JWT and injects claims into the request context.
// As a fallback for SSE (EventSource can't set headers), it also accepts ?token=<jwt>.
func Authenticate(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var rawToken string

			header := r.Header.Get("Authorization")
			if header != "" {
				parts := strings.SplitN(header, " ", 2)
				if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
					response.Unauthorized(w)
					return
				}
				rawToken = parts[1]
			} else if t := r.URL.Query().Get("token"); t != "" {
				rawToken = t
			} else {
				response.Unauthorized(w)
				return
			}

			claims, err := auth.ParseToken(rawToken, jwtSecret)
			if err != nil {
				response.Unauthorized(w)
				return
			}

			ctx := context.WithValue(r.Context(), userClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserClaims retrieves the JWT claims from the context (set by Authenticate middleware).
// Returns nil if the middleware was not applied.
func GetUserClaims(r *http.Request) *auth.Claims {
	claims, _ := r.Context().Value(userClaimsKey).(*auth.Claims)
	return claims
}
