-- Rate limiting extras migration
-- Keeps compatibility with existing environments created via prisma db push.

CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rate_limits_key_action_key'
    ) THEN
        ALTER TABLE rate_limits
            ADD CONSTRAINT rate_limits_key_action_key UNIQUE (key, action);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_action ON rate_limits(key, action);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class
        WHERE relname = 'rate_limits'
          AND relkind = 'r'
          AND relpersistence <> 'u'
    ) THEN
        ALTER TABLE rate_limits SET UNLOGGED;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
