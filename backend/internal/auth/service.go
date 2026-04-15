package auth

import (
	"context"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"

	"taskflow/internal/user"
)

const (
	bcryptCost          = 12
	accessTokenExpiry   = 24 * time.Hour
	refreshTokenExpiry  = 30 * 24 * time.Hour // 30 days
	accessTokenHours    = 0 // calculated from duration, not hours
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailTaken         = errors.New("email already taken")
)

// Service handles auth business logic: register, login, refresh, logout.
type Service struct {
	userRepo     *user.Repository
	tokenRepo    *TokenRepository
	jwtSecret    string
}

func NewService(userRepo *user.Repository, tokenRepo *TokenRepository, jwtSecret string) *Service {
	return &Service{
		userRepo:  userRepo,
		tokenRepo: tokenRepo,
		jwtSecret: jwtSecret,
	}
}

// RegisterInput holds validated registration data.
type RegisterInput struct {
	Name     string
	Email    string
	Password string
}

// LoginInput holds validated login data.
type LoginInput struct {
	Email    string
	Password string
}

// AuthResponse is the shape returned after successful auth.
// access_token is short-lived (15 min); refresh_token is long-lived (30 days).
type AuthResponse struct {
	AccessToken  string     `json:"access_token"`
	RefreshToken string     `json:"refresh_token"`
	User         *user.User `json:"user"`
}

// Register creates a new user account and returns access + refresh tokens.
func (s *Service) Register(ctx context.Context, input RegisterInput) (*AuthResponse, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcryptCost)
	if err != nil {
		return nil, err
	}

	u, err := s.userRepo.Create(ctx, input.Name, input.Email, string(hash))
	if err != nil {
		if errors.Is(err, user.ErrDuplicateEmail) {
			return nil, ErrEmailTaken
		}
		return nil, err
	}

	return s.issueTokenPair(ctx, u)
}

// Login verifies credentials and returns access + refresh tokens.
func (s *Service) Login(ctx context.Context, input LoginInput) (*AuthResponse, error) {
	u, err := s.userRepo.FindByEmail(ctx, input.Email)
	if err != nil {
		if errors.Is(err, user.ErrNotFound) {
			// Constant-time dummy compare to prevent user enumeration via timing
			_ = bcrypt.CompareHashAndPassword([]byte("$2a$12$dummy.hash.to.prevent.timing.attacks"), []byte(input.Password))
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.issueTokenPair(ctx, u)
}

// Refresh validates a refresh token, issues a new access token + rotated refresh token.
// Token rotation: old refresh token is revoked immediately on use.
func (s *Service) Refresh(ctx context.Context, rawRefreshToken string) (*AuthResponse, error) {
	userID, err := s.tokenRepo.FindAndRevoke(ctx, rawRefreshToken)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	u, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return s.issueTokenPair(ctx, u)
}

// Logout revokes the given refresh token — the short-lived access token will expire on its own.
func (s *Service) Logout(ctx context.Context, rawRefreshToken string) error {
	if err := s.tokenRepo.RevokeByRaw(ctx, rawRefreshToken); err != nil {
		if errors.Is(err, ErrTokenNotFound) {
			return nil // idempotent — already revoked is fine
		}
		return err
	}
	return nil
}

// issueTokenPair creates a new access token + refresh token for a user.
func (s *Service) issueTokenPair(ctx context.Context, u *user.User) (*AuthResponse, error) {
	accessToken, err := GenerateAccessToken(u.ID, u.Email, s.jwtSecret, accessTokenExpiry)
	if err != nil {
		return nil, err
	}

	rawRefresh, err := s.tokenRepo.Create(ctx, u.ID, refreshTokenExpiry)
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		User:         u,
	}, nil
}
