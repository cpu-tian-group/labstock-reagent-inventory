CREATE TABLE IF NOT EXISTS reagents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  alias TEXT NOT NULL DEFAULT '—',
  cas TEXT NOT NULL DEFAULT '—',
  category TEXT NOT NULL DEFAULT '其他',
  location TEXT NOT NULL DEFAULT '待分配',
  storage_temp TEXT NOT NULL DEFAULT '待确认',
  stock REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '瓶',
  threshold REAL NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT '偏低',
  supplier TEXT NOT NULL DEFAULT '待补充',
  updated TEXT NOT NULL DEFAULT '刚刚',
  expiry TEXT NOT NULL DEFAULT '待录入',
  notes TEXT NOT NULL DEFAULT '暂无备注。',
  created_by TEXT,
  created_by_email TEXT,
  updated_by TEXT,
  updated_by_email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reagents_category ON reagents(category);
CREATE INDEX IF NOT EXISTS idx_reagents_location ON reagents(location);
CREATE INDEX IF NOT EXISTS idx_reagents_name ON reagents(name);
CREATE INDEX IF NOT EXISTS idx_reagents_cas ON reagents(cas);

PRAGMA optimize;
