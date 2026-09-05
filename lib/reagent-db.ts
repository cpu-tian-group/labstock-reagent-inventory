import { env } from 'cloudflare:workers';

import { fridgeReagents } from '@/app/reagents-data';
import { categoryFilters, classifyReagent } from '@/app/reagent-utils';

export type ReagentStatus = '充足' | '偏低' | '即将过期';

export type ReagentRecord = {
  id: number;
  name: string;
  alias: string;
  cas: string;
  category: string;
  location: string;
  storageTemp: string;
  stock: number;
  unit: string;
  threshold: number;
  status: ReagentStatus;
  supplier: string;
  updated: string;
  expiry: string;
  notes: string;
};

export type ReagentWriteInput = {
  name?: unknown;
  alias?: unknown;
  cas?: unknown;
  category?: unknown;
  location?: unknown;
  storageTemp?: unknown;
  stock?: unknown;
  unit?: unknown;
  supplier?: unknown;
  expiry?: unknown;
  notes?: unknown;
};

export type RequestUser = {
  id: string;
  email: string;
};

type ReagentRow = {
  id: number;
  name: string;
  alias: string;
  cas: string;
  category: string;
  location: string;
  storage_temp: string;
  stock: number;
  unit: string;
  threshold: number;
  status: string;
  supplier: string;
  updated: string;
  expiry: string;
  notes: string;
};

const seedMarker = 'reagents-import-v1';
const allowedCategories = new Set(categoryFilters.slice(1));

const selectColumns = `
  id, name, alias, cas, category, location, storage_temp, stock, unit,
  threshold, status, supplier, updated, expiry, notes
`;

export function getDatabase() {
  return (env as unknown as { DB?: D1Database }).DB ?? null;
}

export function getRequestUser(request: Request): RequestUser {
  return {
    id: request.headers.get('oai-authenticated-user-id') ?? 'local-user',
    email: request.headers.get('oai-authenticated-user-email') ?? '',
  };
}

export function getSeedReagents(): ReagentRecord[] {
  return fridgeReagents.map((reagent) => ({
    ...reagent,
    category: classifyReagent(reagent.name),
    status: reagent.status as ReagentStatus,
  }));
}

function asText(value: unknown, fallback: string) {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStock(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('库存数量必须是大于或等于 0 的数字');
  }
  return parsed;
}

function daysUntil(dateValue: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const target = new Date(`${dateValue}T00:00:00Z`).getTime();
  const today = new Date();
  const start = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.ceil((target - start) / 86400000);
}

function getStatus(stock: number, threshold: number, expiry: string): ReagentStatus {
  const days = daysUntil(expiry);
  if (days !== null && days >= 0 && days <= 30) return '即将过期';
  if (threshold > 0 && stock <= threshold) return '偏低';
  return '充足';
}

export function normalizeWriteInput(
  input: ReagentWriteInput,
  existing?: ReagentRecord,
) {
  const name = asText(input.name, existing?.name ?? '');
  if (!name) throw new Error('试剂名称不能为空');

  const categoryValue = asText(
    input.category,
    existing?.category ?? classifyReagent(name),
  );
  const category = allowedCategories.has(categoryValue)
    ? categoryValue
    : classifyReagent(name);
  const stock = asStock(input.stock ?? existing?.stock ?? 0);
  const threshold = existing?.threshold ?? 1;
  const expiry = asText(input.expiry, existing?.expiry ?? '待录入') || '待录入';

  return {
    name,
    alias: asText(input.alias, existing?.alias ?? '—') || '—',
    cas: asText(input.cas, existing?.cas ?? '—') || '—',
    category,
    location: asText(input.location, existing?.location ?? '待分配') || '待分配',
    storageTemp:
      asText(input.storageTemp, existing?.storageTemp ?? '待确认') || '待确认',
    stock,
    unit: asText(input.unit, existing?.unit ?? '瓶') || '瓶',
    threshold,
    status: getStatus(stock, threshold, expiry),
    supplier: asText(input.supplier, existing?.supplier ?? '待补充') || '待补充',
    updated: '刚刚',
    expiry,
    notes: asText(input.notes, existing?.notes ?? '暂无备注。') || '暂无备注。',
  };
}

function toReagent(row: ReagentRow): ReagentRecord {
  const status: ReagentStatus =
    row.status === '偏低' || row.status === '即将过期' ? row.status : '充足';
  return {
    id: Number(row.id),
    name: row.name,
    alias: row.alias,
    cas: row.cas,
    category: row.category,
    location: row.location,
    storageTemp: row.storage_temp,
    stock: Number(row.stock),
    unit: row.unit,
    threshold: Number(row.threshold),
    status,
    supplier: row.supplier,
    updated: row.updated,
    expiry: row.expiry,
    notes: row.notes,
  };
}

async function getById(db: D1Database, id: number) {
  const row = await db
    .prepare(`SELECT ${selectColumns} FROM reagents WHERE id = ?1`)
    .bind(id)
    .first<ReagentRow>();
  return row ? toReagent(row) : null;
}

export async function ensureSeeded(db: D1Database) {
  const marker = await db
    .prepare('SELECT value FROM inventory_meta WHERE key = ?1')
    .bind(seedMarker)
    .first<{ value: string }>();
  if (marker) return;

  const now = new Date().toISOString();
  const seedStatements = getSeedReagents().map((reagent) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO reagents
          (id, name, alias, cas, category, location, storage_temp, stock, unit,
           threshold, status, supplier, updated, expiry, notes, created_by,
           created_by_email, updated_by, updated_by_email, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
                 ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`,
      )
      .bind(
        reagent.id,
        reagent.name,
        reagent.alias,
        reagent.cas,
        reagent.category,
        reagent.location,
        reagent.storageTemp,
        reagent.stock,
        reagent.unit,
        reagent.threshold,
        reagent.status,
        reagent.supplier,
        reagent.updated,
        reagent.expiry,
        reagent.notes,
        'import',
        '',
        'import',
        '',
        now,
        now,
      ),
  );
  seedStatements.push(
    db
      .prepare(
        'INSERT OR IGNORE INTO inventory_meta (key, value) VALUES (?1, ?2)',
      )
      .bind(seedMarker, now),
  );
  await db.batch(seedStatements);
}

export async function listReagents(db: D1Database) {
  const result = await db
    .prepare(`SELECT ${selectColumns} FROM reagents ORDER BY id DESC`)
    .all<ReagentRow>();
  return result.results.map(toReagent);
}

export async function insertReagent(
  db: D1Database,
  input: ReagentWriteInput,
  user: RequestUser,
) {
  const reagent = normalizeWriteInput(input);
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO reagents
        (name, alias, cas, category, location, storage_temp, stock, unit,
         threshold, status, supplier, updated, expiry, notes, created_by,
         created_by_email, updated_by, updated_by_email, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13,
               ?14, ?15, ?16, ?17, ?18, ?19, ?20)`,
    )
    .bind(
      reagent.name,
      reagent.alias,
      reagent.cas,
      reagent.category,
      reagent.location,
      reagent.storageTemp,
      reagent.stock,
      reagent.unit,
      reagent.threshold,
      reagent.status,
      reagent.supplier,
      reagent.updated,
      reagent.expiry,
      reagent.notes,
      user.id,
      user.email,
      user.id,
      user.email,
      now,
      now,
    )
    .run();
  return getById(db, Number(result.meta.last_row_id));
}

export async function updateReagent(
  db: D1Database,
  id: number,
  input: ReagentWriteInput,
  user: RequestUser,
) {
  const existing = await getById(db, id);
  if (!existing) return null;
  const reagent = normalizeWriteInput(input, existing);
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE reagents SET
        name = ?1, alias = ?2, cas = ?3, category = ?4, location = ?5,
        storage_temp = ?6, stock = ?7, unit = ?8, threshold = ?9,
        status = ?10, supplier = ?11, updated = ?12, expiry = ?13,
        notes = ?14, updated_by = ?15, updated_by_email = ?16, updated_at = ?17
       WHERE id = ?18`,
    )
    .bind(
      reagent.name,
      reagent.alias,
      reagent.cas,
      reagent.category,
      reagent.location,
      reagent.storageTemp,
      reagent.stock,
      reagent.unit,
      reagent.threshold,
      reagent.status,
      reagent.supplier,
      reagent.updated,
      reagent.expiry,
      reagent.notes,
      user.id,
      user.email,
      now,
      id,
    )
    .run();
  return getById(db, id);
}

export async function deleteReagent(db: D1Database, id: number) {
  const result = await db
    .prepare('DELETE FROM reagents WHERE id = ?1')
    .bind(id)
    .run();
  return Number(result.meta.changes ?? 0) > 0;
}
