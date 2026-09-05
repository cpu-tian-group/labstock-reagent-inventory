/**
 * The D1 schema for the shared laboratory reagent inventory.
 *
 * SQL migrations live in ./../drizzle so the Sites deployment can apply them
 * before the Worker starts serving requests. Keeping this description here
 * makes the data contract easy to find without adding a runtime ORM bundle.
 */
export const reagentTable = {
  name: 'reagents',
  columns: {
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    name: 'TEXT NOT NULL',
    alias: "TEXT NOT NULL DEFAULT '—'",
    cas: "TEXT NOT NULL DEFAULT '—'",
    category: "TEXT NOT NULL DEFAULT '其他'",
    location: "TEXT NOT NULL DEFAULT '待分配'",
    storageTemp: "TEXT NOT NULL DEFAULT '待确认'",
    stock: 'REAL NOT NULL DEFAULT 0',
    unit: "TEXT NOT NULL DEFAULT '瓶'",
    threshold: 'REAL NOT NULL DEFAULT 1',
    status: "TEXT NOT NULL DEFAULT '偏低'",
    supplier: "TEXT NOT NULL DEFAULT '待补充'",
    updated: "TEXT NOT NULL DEFAULT '刚刚'",
    expiry: "TEXT NOT NULL DEFAULT '待录入'",
    notes: "TEXT NOT NULL DEFAULT '暂无备注。'",
    createdBy: 'TEXT',
    createdByEmail: 'TEXT',
    updatedBy: 'TEXT',
    updatedByEmail: 'TEXT',
    createdAt: 'TEXT NOT NULL',
    updatedAt: 'TEXT NOT NULL',
  },
} as const;

export const inventoryMetaTable = {
  name: 'inventory_meta',
  columns: {
    key: 'TEXT PRIMARY KEY',
    value: 'TEXT NOT NULL',
  },
} as const;
