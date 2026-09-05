ALTER TABLE reagents ADD COLUMN deleted_at TEXT;
ALTER TABLE reagents ADD COLUMN deleted_by TEXT;

CREATE INDEX IF NOT EXISTS idx_reagents_deleted_at
  ON reagents(deleted_at);
