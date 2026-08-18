ALTER TABLE users
  ADD CONSTRAINT users_username_format_ck
    CHECK (username ~ '^[A-Za-z0-9_]{3,24}$'),
  ADD CONSTRAINT users_username_normalized_format_ck
    CHECK (username_normalized ~ '^[a-z0-9_]{3,24}$'),
  ADD CONSTRAINT users_username_normalized_matches_ck
    CHECK (username_normalized = LOWER(username));
