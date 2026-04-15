-- Refresh tokens enable real logout and short-lived access tokens.
-- We store only the SHA-256 hash of the opaque token — never the raw value.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,  -- hex-encoded SHA-256
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,                   -- NULL = active
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
