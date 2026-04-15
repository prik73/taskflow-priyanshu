# TaskFlow

A task management system where users can register, create projects, add tasks, and assign them to teammates.

**Stack:** Go · PostgreSQL · React + TypeScript + Vite · Docker

---

## 1. Overview

TaskFlow is a full-stack application built around a RESTful Go API and a React SPA. The backend follows a layered handler → service → repository architecture connected to PostgreSQL via `pgx/v5`. Authentication uses 24-hour JWT access tokens plus 30-day refresh tokens (stored as SHA-256 hashes) to support real logout and token rotation. The frontend is a Vite + React + TypeScript app served through nginx.

| Layer | Choice |
|---|---|
| API | Go + chi router |
| Database | PostgreSQL 16 + pgx/v5 (connection pool) |
| Migrations | golang-migrate (embedded, auto-run on start) |
| Logging | zap (structured JSON in prod, pretty in dev) |
| Auth | JWT HS256 + opaque refresh tokens |
| Frontend | React 19 + TypeScript + Vite + oat.ink |

---

## 2. Architecture Decisions

**Layered backend (handler → service → repository)**
Each layer has one job: handlers parse HTTP, services enforce business rules, repositories talk to Postgres. This keeps SQL out of business logic and makes each layer independently testable.

**Stateful refresh tokens**
Pure JWT can't be revoked. We issue a short-lived access token + a 30-day refresh token stored as a SHA-256 hash. On refresh the old token is atomically revoked, enabling real logout and future theft detection.

**Avoiding circular imports with a closure**
`task.Service` needs a project's `owner_id` for delete authorization, but importing `project` from `task` creates a cycle. We inject a `getOwnerID func(ctx, id) (uuid, error)` closure from `main.go` — zero overhead, no reflection.

**All projects visible to all authenticated users**
The spec says "list projects the user owns or has tasks in." In practice this creates a chicken-and-egg problem: a user can't be assigned to a task on a project they can't see. Since the spec also says users should assign tasks to themselves or others, the intent is a shared workspace. Ownership still controls who can edit or delete.

**`need_review` and `resolved` instead of `done`**
Extended the spec's `todo | in_progress | done` to `todo | in_progress | need_review | resolved` to reflect a real review workflow — a task under review is meaningfully different from one that is signed off. This is an intentional product improvement.

---

## 3. Running Locally

> **Prerequisites:** Docker and Docker Compose only.

```bash
# 1. Clone
git clone https://github.com/prik73/taskflow-priyanshu
cd taskflow-priyanshu

# 2. Configure environment
cp .env.example .env
# Minimum: set a real JWT_SECRET
# openssl rand -hex 32   ← paste result into .env as JWT_SECRET

# 3. Start everything
docker compose up

# Frontend  →  http://localhost:3000
# API       →  http://localhost:8080
# Health    →  http://localhost:8080/health
```

The `seed` service inserts demo data automatically on first run. To re-seed:

```bash
docker compose run --rm seed
```

---

## 4. Running Without Docker

> **Prerequisites:** Go 1.23+, Node 20+, and a running PostgreSQL instance (or just spin up the DB container).

**Backend**

```bash
# Start only the database
docker compose up postgres -d

# In the backend directory
cd backend
ENV=development \
JWT_SECRET=dev-secret \
DB_HOST=localhost \
DB_PORT=5432 \
DB_USER=taskflow \
DB_PASSWORD=taskflow_password \
DB_NAME=taskflow \
DB_SSLMODE=disable \
PORT=8080 \
go run ./cmd/server/main.go
```

**Frontend**

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

The Vite dev server proxies API calls to `http://localhost:8080` by default via `VITE_API_URL`.

---

## 5. Running Migrations (standalone)

Migrations run **automatically** when the API container starts — nothing to do manually.

To run them against a standalone Postgres:

```bash
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

migrate \
  -path ./backend/migrations \
  -database "postgres://taskflow:taskflow_password@localhost:5432/taskflow?sslmode=disable" \
  up
```

---

## 6. Test Credentials

| User | Email | Password |
|---|---|---|
| Amit ji (project owner) | `test@example.com` | `password123` |
| Narendra ji (teammate) | `narendra@example.com` | `password123` |

Amit ji owns a **Website Redesign** project with three tasks in different statuses. Log in as Narendra ji to see he's assigned to one of them.

---

## 7. API Reference

**Base URL:** `http://localhost:8080`  
All protected endpoints require `Authorization: Bearer <access_token>`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | `{name, email, password}` → `{access_token, refresh_token, user}` |
| POST | `/auth/login` | `{email, password}` → `{access_token, refresh_token, user}` |
| POST | `/auth/refresh` | `{refresh_token}` → new token pair (rotates old token) |
| POST | `/auth/logout` | `{refresh_token}` → 204 |

### Projects

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects?page=&limit=` | List all projects |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Project + all its tasks |
| PATCH | `/projects/:id` | Update name/description — owner only |
| DELETE | `/projects/:id` | Delete project + tasks — owner only |
| GET | `/projects/:id/stats` | Task counts by status and by assignee |
| GET | `/projects/:id/events` | SSE stream for real-time task events |

### Tasks

| Method | Endpoint | Description |
|---|---|---|
| GET | `/projects/:id/tasks?status=&assignee=&page=&limit=` | Filtered, paginated task list |
| POST | `/projects/:id/tasks` | `{title, description?, priority, assignee_id?, due_date?}` |
| PATCH | `/tasks/:id` | Update any of `{title, description, status, priority, assignee_id, due_date, clear_assignee}` |
| DELETE | `/tasks/:id` | Project owner or task creator only |

### Users

| Method | Endpoint | Description |
|---|---|---|
| GET | `/users` | List all users (for assignee picker) |

### Error shape

```json
{ "error": "validation failed", "fields": { "email": "is required" } }
```

`400` validation · `401` unauthenticated · `403` forbidden · `404` not found

---

## 8. Integration Tests

Tests live in `backend/integration/` and run against a real PostgreSQL database. They are skipped automatically when `INTEGRATION_DSN` is not set.

```bash
INTEGRATION_DSN="postgres://taskflow:taskflow_password@localhost:5433/taskflow?sslmode=disable" \
JWT_SECRET=dev-secret \
go test ./backend/integration/... -v -count=1
```

**21 subtests across 3 suites:**

| Suite | Coverage |
|---|---|
| `TestAuth_RegisterAndLogin` | Register, duplicate email, login, wrong password, missing token, field validation |
| `TestTasks_FullLifecycle` | Create, list, filter, invalid filter, update status, delete, 404 on deleted |
| `TestAuthorization` | 401 vs 403 distinction, owner-only edits, non-creator task delete, 404 |

---

## 9. What I'd Do With More Time

**Security**
- Rate limiting (token bucket per IP) on auth endpoints
- Refresh token reuse detection: if a rotated token is replayed, revoke the entire family
- Lock CORS to the frontend origin (currently `*`)

**Backend**
- `GET /users/me` so the frontend doesn't have to decode the JWT client-side
- Full-text task search (`?q=`)
- Activity history: log every task change (status, assignee, priority) with who made it and when — so the whole team can see what happened and when

**Shortcuts taken**
- No request-level tracing (only request IDs); a real system would use OpenTelemetry
- No HTTPS termination in nginx (would add Let's Encrypt in production)
