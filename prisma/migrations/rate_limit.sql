-- Rate Limiting Table (UNLOGGED for performance)
-- Run this migration manually: psql $DATABASE_URL -f prisma/migrations/rate_limit.sql

-- Drop if exists (for re-running)
DROP TABLE IF EXISTS rate_limits;

-- Create UNLOGGED table for rate limiting
-- UNLOGGED = no WAL writes = faster, but data lost on crash (acceptable for rate limits)
CREATE UNLOGGED TABLE rate_limits (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,           -- e.g., "register:192.168.1.1" or "login:user@example.com"
    action VARCHAR(50) NOT NULL,          -- e.g., "register", "login", "api"
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Unique constraint for upsert operations
    UNIQUE(key, action)
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_key_action ON rate_limits(key, action);

-- Index for cleanup operations
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);

-- Auto-cleanup function: removes expired entries
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
