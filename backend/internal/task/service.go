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
	taskRepo    *Repository
	historyRepo *HistoryRepository
	getOwnerID  func(ctx context.Context, projectID uuid.UUID) (uuid.UUID, error)
}

// NewService constructs the task service.
// getOwnerID is a closure that accepts a project ID and returns its owner UUID — injected from main
// to avoid a circular import between task ↔ project packages.
func NewService(taskRepo *Repository, historyRepo *HistoryRepository, getOwnerID func(ctx context.Context, id uuid.UUID) (uuid.UUID, error)) *Service {
	return &Service{taskRepo: taskRepo, historyRepo: historyRepo, getOwnerID: getOwnerID}
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
	t, err := s.taskRepo.Create(ctx, CreateInput{
		Title:       in.Title,
		Description: in.Description,
		Priority:    in.Priority,
		ProjectID:   in.ProjectID,
		AssigneeID:  in.AssigneeID,
		CreatorID:   in.CreatorID,
		DueDate:     in.DueDate,
	})
	if err != nil {
		return nil, err
	}

	// Record creation history
	_ = s.historyRepo.Insert(ctx, []HistoryEntry{
		{TaskID: t.ID, UserID: &in.CreatorID, Field: "created", OldValue: nil, NewValue: nil},
	})

	return t, nil
}

// Update applies a partial update — any authenticated user can update tasks they can see.
// (spec doesn't restrict task updates to specific roles)
func (s *Service) Update(ctx context.Context, id, requesterID uuid.UUID, in UpdateInput) (*Task, error) {
	// Fetch current state for diff
	old, err := s.taskRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	t, err := s.taskRepo.Update(ctx, id, in)
	if err != nil {
		return nil, err
	}

	// Record field-level changes
	entries := diffTask(old, t, requesterID)
	if len(entries) > 0 {
		_ = s.historyRepo.Insert(ctx, entries)
	}

	return t, nil
}

// GetHistory returns the activity history for a task.
func (s *Service) GetHistory(ctx context.Context, taskID uuid.UUID) ([]*HistoryEntry, error) {
	return s.historyRepo.ListForTask(ctx, taskID)
}

func (s *Service) GetProjectHistory(ctx context.Context, projectID uuid.UUID, limit, offset int) ([]*ProjectHistoryEntry, error) {
	return s.historyRepo.ListForProject(ctx, projectID, limit, offset)
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

// ptrStr safely dereferences a *string, returning "" for nil.
func ptrStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// strPtr converts a string to *string.
func strPtr(s string) *string {
	return &s
}

// diffTask compares old and new Task states and returns history entries for changed fields.
func diffTask(old, newT *Task, userID uuid.UUID) []HistoryEntry {
	var entries []HistoryEntry

	add := func(field string, oldVal, newVal *string) {
		if ptrStr(oldVal) != ptrStr(newVal) {
			entries = append(entries, HistoryEntry{
				TaskID:   newT.ID,
				UserID:   &userID,
				Field:    field,
				OldValue: oldVal,
				NewValue: newVal,
			})
		}
	}

	// status
	oldStatus := string(old.Status)
	newStatus := string(newT.Status)
	add("status", &oldStatus, &newStatus)

	// priority
	oldPriority := string(old.Priority)
	newPriority := string(newT.Priority)
	add("priority", &oldPriority, &newPriority)

	// assignee_id
	var oldAssignee, newAssignee *string
	if old.AssigneeID != nil {
		s := old.AssigneeID.String()
		oldAssignee = &s
	}
	if newT.AssigneeID != nil {
		s := newT.AssigneeID.String()
		newAssignee = &s
	}
	add("assignee_id", oldAssignee, newAssignee)

	// title
	add("title", &old.Title, &newT.Title)

	// description
	add("description", old.Description, newT.Description)

	// due_date
	var oldDue, newDue *string
	if old.DueDate != nil {
		s := old.DueDate.Format("2006-01-02")
		oldDue = &s
	}
	if newT.DueDate != nil {
		s := newT.DueDate.Format("2006-01-02")
		newDue = &s
	}
	add("due_date", oldDue, newDue)

	_ = strPtr // used elsewhere if needed

	return entries
}
