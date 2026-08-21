ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pronouns VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS about_me VARCHAR(300) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7) NOT NULL DEFAULT '#22D3EE',
  ADD COLUMN IF NOT EXISTS custom_status VARCHAR(80) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS presence_status VARCHAR(16) NOT NULL DEFAULT 'online';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_accent_color_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_accent_color_ck
      CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_presence_status_ck'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_presence_status_ck
      CHECK (presence_status IN ('online', 'dnd', 'invisible'));
  END IF;
END $$;

ALTER TABLE server_members
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(40);
