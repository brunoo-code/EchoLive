CREATE TABLE IF NOT EXISTS servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  icon_url TEXT NOT NULL DEFAULT '',
  privacy VARCHAR(16) NOT NULL DEFAULT 'private' CHECK (privacy IN ('private', 'public')),
  allow_friend_join BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS servers_owner_idx ON servers (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS server_members (
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS server_members_user_idx ON server_members (user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS server_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  type VARCHAR(16) NOT NULL CHECK (type IN ('text', 'voice')),
  name VARCHAR(40) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, name)
);

CREATE INDEX IF NOT EXISTS server_channels_server_idx ON server_channels (server_id, position, created_at);

CREATE TABLE IF NOT EXISTS server_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES server_channels(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content VARCHAR(4000) NOT NULL DEFAULT '',
  attachment JSONB,
  reply_to_message_id UUID REFERENCES server_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CHECK (char_length(content) <= 4000),
  CHECK (char_length(btrim(content)) > 0 OR attachment IS NOT NULL OR deleted_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS server_messages_channel_idx
  ON server_messages (channel_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS server_messages_server_idx
  ON server_messages (server_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS server_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL UNIQUE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  uses INTEGER NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS server_invites_server_idx ON server_invites (server_id, created_at DESC);
