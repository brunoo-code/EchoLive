ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type VARCHAR(16) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS system_key VARCHAR(64);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_account_type_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_type_ck
      CHECK (account_type IN ('user', 'system'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_system_key_idx
  ON users (system_key)
  WHERE system_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  description VARCHAR(240) NOT NULL,
  icon_key VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS user_badges_user_idx
  ON user_badges (user_id, granted_at DESC);

ALTER TABLE dm_messages
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(16) NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS official_key VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS dm_messages_official_key_idx
  ON dm_messages (conversation_id, official_key)
  WHERE official_key IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dm_messages_type_ck'
  ) THEN
    ALTER TABLE dm_messages
      ADD CONSTRAINT dm_messages_type_ck
      CHECK (message_type IN ('user', 'official'));
  END IF;
END $$;

INSERT INTO badges (code, label, description, icon_key)
VALUES (
  'echolive_beta',
  'EchoLive Beta',
  'Participou da fase beta do EchoLive.',
  'sparkles'
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  icon_key = EXCLUDED.icon_key;

INSERT INTO user_badges (user_id, badge_id)
SELECT u.id, b.id
FROM users u
JOIN badges b ON b.code = 'echolive_beta'
WHERE u.account_type = 'user'
ON CONFLICT (user_id, badge_id) DO NOTHING;
