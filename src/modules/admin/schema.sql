-- Admin settings table (key-value store)
CREATE TABLE IF NOT EXISTS admin_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed initial settings
INSERT INTO admin_settings (key, value)
VALUES ('settlement_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Per-ambassador settlement toggle (default: enabled)
ALTER TABLE ambassador_profile
  ADD COLUMN IF NOT EXISTS settlement_enabled BOOLEAN DEFAULT true;
