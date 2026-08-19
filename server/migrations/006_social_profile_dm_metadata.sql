ALTER TABLE dm_participants
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

ALTER TABLE dm_messages
  ADD COLUMN IF NOT EXISTS attachment JSONB;

DO $$
DECLARE
  content_constraint TEXT;
BEGIN
  SELECT conname INTO content_constraint
  FROM pg_constraint
  WHERE conrelid = 'dm_messages'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%char_length%content%'
  LIMIT 1;
  IF content_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE dm_messages DROP CONSTRAINT %I', content_constraint);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dm_messages_content_or_attachment_ck') THEN
    ALTER TABLE dm_messages
      ADD CONSTRAINT dm_messages_content_or_attachment_ck
      CHECK ((char_length(btrim(content)) BETWEEN 1 AND 4000) OR attachment IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dm_participants_visible_idx
  ON dm_participants (user_id, hidden_at, conversation_id);
