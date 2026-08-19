CREATE TABLE IF NOT EXISTS server_message_reactions (
  message_id UUID NOT NULL REFERENCES server_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(16) NOT NULL CHECK (char_length(btrim(emoji)) BETWEEN 1 AND 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS server_message_reactions_message_idx
  ON server_message_reactions (message_id, emoji);
