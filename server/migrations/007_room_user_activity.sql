CREATE TABLE IF NOT EXISTS room_user_activity (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_code VARCHAR(9) NOT NULL,
  room_display_name VARCHAR(120) NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, room_code)
);

CREATE INDEX IF NOT EXISTS room_user_activity_lookup_idx
  ON room_user_activity (user_id, expires_at, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS room_user_activity_room_idx
  ON room_user_activity (room_code, expires_at, last_seen_at DESC);
