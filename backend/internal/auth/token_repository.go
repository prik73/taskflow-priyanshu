package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrTokenNotFound is returned when a refresh token does not exist or is revoked/expired.
var ErrTokenNotFound = errors.New("refresh token not found or invalid")

// RefreshToken is the DB representation of a stored refresh token.
type RefreshToken struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	TokenHash string
	ExpiresAt time.Time
	RevokedAt *time.Time
	CreatedAt time.Time
}

// TokenRepository handles refresh token persistence.
type TokenRepository struct {
	db *pgxpool.Pool
}

func NewTokenRepository(db *pgxpool.Pool) *TokenRepository {
	return &TokenRepository{db: db}
}

// generateOpaque creates a cryptographically random 32-byte token and returns
// both the raw token (given to the client) and its SHA-256 hex hash (stored in DB).
func generateOpaque() (raw, hash string, err error) {
	buf := make([]byte, 32)
	if _, err = rand.Read(buf); err != nil {
		return
	}
	raw = hex.EncodeToString(buf)
	sum := sha256.Sum256([]byte(raw))
	hash = hex.EncodeToString(sum[:])
	return
}

// hashToken returns the SHA-256 hex hash of a raw token — used when looking up a client-provided token.
func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// Create inserts a new refresh token and returns the raw (unhashed) token to send to the client.
func (r *TokenRepository) Create(ctx context.Context, userID uuid.UUID, ttl time.Duration) (rawToken string, err error) {
	raw, hash, err := generateOpaque()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(ttl)
	_, err = r.db.Exec(ctx, `
		INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, hash, expiresAt)
	if err != nil {
		return "", err
	}
	return raw, nil
}

// FindAndRevoke atomically validates a raw refresh token and marks it revoked.
// Returns the associated userID so the caller can issue a new access token.
func (r *TokenRepository) FindAndRevoke(ctx context.Context, rawToken string) (uuid.UUID, error) {
	hash := hashToken(rawToken)

	var rt RefreshToken
	err := r.db.QueryRow(ctx, `
		SELECT id, user_id, expires_at, revoked_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`, hash).Scan(&rt.ID, &rt.UserID, &rt.ExpiresAt, &rt.RevokedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrTokenNotFound
		}
		return uuid.Nil, err
	}

	// Reject revoked or expired tokens
	if rt.RevokedAt != nil || time.Now().After(rt.ExpiresAt) {
		return uuid.Nil, ErrTokenNotFound
	}

	// Revoke it immediately — one-time use (token rotation)
	_, err = r.db.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1
	`, rt.ID)
	if err != nil {
		return uuid.Nil, err
	}

	return rt.UserID, nil
}

// RevokeAllForUser revokes every active refresh token for a user (used on logout-all / password change).
func (r *TokenRepository) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL
	`, userID)
	return err
}

// RevokeByRaw revokes a single token identified by its raw value (used on logout).
func (r *TokenRepository) RevokeByRaw(ctx context.Context, rawToken string) error {
	hash := hashToken(rawToken)
	tag, err := r.db.Exec(ctx, `
		UPDATE refresh_tokens SET revoked_at = NOW()
		WHERE token_hash = $1 AND revoked_at IS NULL
	`, hash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrTokenNotFound
	}
	return nil
}
