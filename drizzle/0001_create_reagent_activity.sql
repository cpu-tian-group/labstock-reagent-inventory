CREATE TABLE IF NOT EXISTS reagent_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  reagent_id INTEGER,
  reagent_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reagent_activity_created_at
  ON reagent_activity(created_at);

CREATE INDEX IF NOT EXISTS idx_reagent_activity_reagent_id
  ON reagent_activity(reagent_id);
