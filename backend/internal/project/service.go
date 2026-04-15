package project

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var ErrForbidden = errors.New("forbidden")

// Service contains project business logic and authorization.
type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListAll(ctx context.Context, page, limit int) ([]*Project, int64, error) {
	return s.repo.ListAll(ctx, page, limit)
}

func (s *Service) Create(ctx context.Context, name string, description *string, ownerID uuid.UUID) (*Project, error) {
	return s.repo.Create(ctx, name, description, ownerID)
}

func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Project, error) {
	return s.repo.FindByID(ctx, id)
}

// Update patches a project — only the owner is allowed.
func (s *Service) Update(ctx context.Context, id, requesterID uuid.UUID, name string, description *string) (*Project, error) {
	p, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.OwnerID != requesterID {
		return nil, ErrForbidden
	}
	return s.repo.Update(ctx, id, name, description)
}

// Delete removes a project — only the owner is allowed.
func (s *Service) Delete(ctx context.Context, id, requesterID uuid.UUID) error {
	p, err := s.repo.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if p.OwnerID != requesterID {
		return ErrForbidden
	}
	return s.repo.Delete(ctx, id)
}

// GetStats is the bonus endpoint — any user who can see the project may view stats.
func (s *Service) GetStats(ctx context.Context, id uuid.UUID) (*Stats, error) {
	if _, err := s.repo.FindByID(ctx, id); err != nil {
		return nil, err
	}
	return s.repo.GetStats(ctx, id)
}
