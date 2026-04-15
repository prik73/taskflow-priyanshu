package project

import (
	"time"

	"github.com/google/uuid"
)

// Project is the core project domain entity.
type Project struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description"`
	OwnerID     uuid.UUID  `json:"owner_id"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// StatusStat holds task count for a given status.
type StatusStat struct {
	Status string `json:"status"`
	Count  int64  `json:"count"`
}

// AssigneeStat holds task count grouped by assignee.
type AssigneeStat struct {
	AssigneeID   *uuid.UUID `json:"assignee_id"`
	AssigneeName *string    `json:"assignee_name"`
	Count        int64      `json:"count"`
}

// Stats is the bonus /projects/:id/stats response.
type Stats struct {
	ByStatus   []StatusStat   `json:"by_status"`
	ByAssignee []AssigneeStat `json:"by_assignee"`
}
