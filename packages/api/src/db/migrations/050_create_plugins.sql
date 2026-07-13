-- @feature plugins
-- Plugins system: the registry of installed plugins + a plugin-scoped
-- migration ledger. Plugin-owned domain tables are created by each plugin's
-- own migrations/install and are prefixed `plugin_<name>_*`.

CREATE TABLE IF NOT EXISTS plugins (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(64) UNIQUE NOT NULL,
    label             VARCHAR(160) NOT NULL,
    version           VARCHAR(32) NOT NULL,
    installed_version VARCHAR(32),
    source            VARCHAR(16) NOT NULL DEFAULT 'manual',
    location          TEXT NOT NULL,
    installed         BOOLEAN NOT NULL DEFAULT false,
    enabled           BOOLEAN NOT NULL DEFAULT false,
    config            JSONB NOT NULL DEFAULT '{}'::jsonb,
    manifest          JSONB NOT NULL DEFAULT '{}'::jsonb,
    error             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plugins_enabled ON plugins(enabled);

-- Per-plugin migration ledger (namespaced; keeps plugin SQL out of the core
-- globally-sorted schema_migrations directory).
CREATE TABLE IF NOT EXISTS plugin_migrations (
    plugin     VARCHAR(64) NOT NULL,
    filename   VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (plugin, filename)
);

-- updated_at trigger (reuse the shared function if present).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        DROP TRIGGER IF EXISTS trg_plugins_updated_at ON plugins;
        CREATE TRIGGER trg_plugins_updated_at BEFORE UPDATE ON plugins
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
