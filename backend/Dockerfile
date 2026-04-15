# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS builder

# Install build tools
RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /app

# Copy dependency files first (Docker layer caching)
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build the server binary — statically linked, no CGO
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /app/server ./cmd/server/main.go

# Build the seed binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /app/seed ./cmd/seed/main.go

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM scratch

# Copy TLS certs (needed for HTTPS outbound calls if any)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
# Copy timezone data
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo
# Copy the binaries — nothing else
COPY --from=builder /app/server /server
COPY --from=builder /app/seed   /seed

EXPOSE 8080

ENTRYPOINT ["/server"]
