package user

import (
	"time"

	"github.com/google/uuid"
)

// User is the core domain entity. PasswordHash is never serialised to JSON.
type User struct {
	ID           uuid.UUID `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
}
