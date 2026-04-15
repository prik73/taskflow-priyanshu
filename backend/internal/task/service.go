package task

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrForbidden       = errors.New("forbidden")
	ErrProjectNotFound = errors.New("project not found")
)

// Service contains task business logic, including cross-entity authorization.
type Service struct {
	taskRepo   *Repository
	getOwnerID func(ctx context.Context, projectID uuid.UUID) (uuid.UUID, error)
}

// NewService constructs the task service.
// getOwnerID is a closure that accepts a project ID and returns its owner UUID — injected from main
// to avoid a circular import between task ↔ project packages.
func NewService(taskRepo *Repository, getOwnerID func(ctx context.Context, id uuid.UUID) (uuid.UUID, error)) *Service {
	return &Service{taskRepo: taskRepo, getOwnerID: getOwnerID}
}

// CreateTaskInput is the service-level create request.
type CreateTaskInput struct {
	Title       string
	Description *string
	Priority    Priority
	ProjectID   uuid.UUID
	AssigneeID  *uuid.UUID
	CreatorID   uuid.UUID
	DueDate     *time.Time
}

// List returns tasks for a project, verifying the project exists first.
func (s *Service) List(ctx context.Context, projectID uuid.UUID, f ListFilters) ([]*Task, int64, error) {
	if _, err := s.getOwnerID(ctx, projectID); err != nil {
		return nil, 0, ErrProjectNotFound
	}
	return s.taskRepo.List(ctx, projectID, f)
}

// Create validates the project exists then inserts the task.
func (s *Service) Create(ctx context.Context, in CreateTaskInput) (*Task, error) {
	if _, err := s.getOwnerID(ctx, in.ProjectID); err != nil {
		return nil, ErrProjectNotFound
	}
	return s.taskRepo.Create(ctx, CreateInput{
		Title:       in.Title,
		Description: in.Description,
		Priority:    in.Priority,
		ProjectID:   in.ProjectID,
		AssigneeID:  in.AssigneeID,
		CreatorID:   in.CreatorID,
		DueDate:     in.DueDate,
	})
}

// Update applies a partial update — any authenticated user can update tasks they can see.
// (spec doesn't restrict task updates to specific roles)
func (s *Service) Update(ctx context.Context, id, _ uuid.UUID, in UpdateInput) (*Task, error) {
	return s.taskRepo.Update(ctx, id, in)
}

// Delete removes a task — only the project owner or the task creator may delete.
// Returns the task's projectID so callers can publish SSE events after deletion.
func (s *Service) Delete(ctx context.Context, id, requesterID uuid.UUID) (uuid.UUID, error) {
	t, err := s.taskRepo.FindByID(ctx, id)
	if err != nil {
		return uuid.Nil, err
	}
	ownerID, err := s.getOwnerID(ctx, t.ProjectID)
	if err != nil {
		return uuid.Nil, ErrProjectNotFound
	}

	// Allow: project owner OR task creator
	isOwner := ownerID == requesterID
	isCreator := t.CreatorID != nil && *t.CreatorID == requesterID
	if !isOwner && !isCreator {
		return uuid.Nil, ErrForbidden
	}

	return t.ProjectID, s.taskRepo.Delete(ctx, id)
}
