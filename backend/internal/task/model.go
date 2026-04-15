package task

import (
	"time"

	"github.com/google/uuid"
)

// Status represents the lifecycle state of a task.
type Status string

// Priority represents the urgency level of a task.
type Priority string

const (
	StatusTodo       Status = "todo"
	StatusInProgress Status = "in_progress"
	StatusNeedReview Status = "need_review"
	StatusResolved   Status = "resolved"
)

const (
	PriorityLow    Priority = "low"
	PriorityMedium Priority = "medium"
	PriorityHigh   Priority = "high"
)

// Task is the core task domain entity.
type Task struct {
	ID          uuid.UUID  `json:"id"`
	Title       string     `json:"title"`
	Description *string    `json:"description"`
	Status      Status     `json:"status"`
	Priority    Priority   `json:"priority"`
	ProjectID   uuid.UUID  `json:"project_id"`
	AssigneeID  *uuid.UUID `json:"assignee_id"`
	CreatorID   *uuid.UUID `json:"creator_id"`
	DueDate     *time.Time `json:"due_date"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// IsValidStatus checks if a string is a valid task status.
func IsValidStatus(s string) bool {
	switch Status(s) {
	case StatusTodo, StatusInProgress, StatusNeedReview, StatusResolved:
		return true
	}
	return false
}

// IsValidPriority checks if a string is a valid task priority.
func IsValidPriority(s string) bool {
	switch Priority(s) {
	case PriorityLow, PriorityMedium, PriorityHigh:
		return true
	}
	return false
}
