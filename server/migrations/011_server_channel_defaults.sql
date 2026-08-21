ALTER TABLE server_channels
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY server_id, type
           ORDER BY CASE WHEN (type = 'text' AND name = 'geral') OR (type = 'voice' AND name = 'Geral') THEN 0 ELSE 1 END,
                    position ASC,
                    created_at ASC,
                    id ASC
         ) AS row_number
  FROM server_channels
)
UPDATE server_channels AS channel
SET is_default = TRUE
FROM ranked
WHERE channel.id = ranked.id
  AND ranked.row_number = 1;

CREATE UNIQUE INDEX IF NOT EXISTS server_channels_one_default_per_type
  ON server_channels (server_id, type)
  WHERE is_default;
