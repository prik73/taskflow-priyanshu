// Package sse provides a simple in-memory pub/sub broadcaster for Server-Sent Events.
// Each project gets its own channel set; clients subscribe to a project and receive
// JSON-encoded task events (created, updated, deleted).
package sse

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/google/uuid"
)

// EventType describes what happened to a task.
type EventType string

const (
	EventTaskCreated EventType = "task.created"
	EventTaskUpdated EventType = "task.updated"
	EventTaskDeleted EventType = "task.deleted"
)

// Event is the payload sent to all subscribers of a project.
type Event struct {
	Type      EventType `json:"type"`
	ProjectID uuid.UUID `json:"project_id"`
	Payload   any       `json:"payload"` // *task.Task for created/updated, {id} for deleted
}

// client holds a single SSE connection's send channel.
type client struct {
	ch chan Event
}

// Broker manages subscriptions and fan-out for all projects.
type Broker struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]map[*client]struct{}
}

func NewBroker() *Broker {
	return &Broker{
		clients: make(map[uuid.UUID]map[*client]struct{}),
	}
}

// Publish sends an event to all clients subscribed to projectID.
func (b *Broker) Publish(projectID uuid.UUID, ev Event) {
	b.mu.RLock()
	subs := b.clients[projectID]
	b.mu.RUnlock()

	for c := range subs {
		select {
		case c.ch <- ev:
		default: // drop if client is slow — don't block the writer
		}
	}
}

// ServeHTTP handles a GET request and streams events until the client disconnects.
// The projectID must be provided by the caller before invoking.
func (b *Broker) ServeProject(projectID uuid.UUID, w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering

	c := &client{ch: make(chan Event, 16)}
	b.subscribe(projectID, c)
	defer b.unsubscribe(projectID, c)

	// Send a keepalive comment immediately so the client knows the stream is live
	fmt.Fprintf(w, ": connected\n\n")
	flusher.Flush()

	for {
		select {
		case ev := <-c.ch:
			data, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.Type, data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func (b *Broker) subscribe(projectID uuid.UUID, c *client) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.clients[projectID] == nil {
		b.clients[projectID] = make(map[*client]struct{})
	}
	b.clients[projectID][c] = struct{}{}
}

func (b *Broker) unsubscribe(projectID uuid.UUID, c *client) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.clients[projectID], c)
	if len(b.clients[projectID]) == 0 {
		delete(b.clients, projectID)
	}
}
