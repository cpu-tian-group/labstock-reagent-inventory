import {
  ensureSeeded,
  getDatabase,
  getReagentById,
  getRequestUser,
  permanentlyDeleteReagent,
  recordActivity,
} from '@/lib/reagent-db';
import { requireInviteAccess } from '@/lib/invite-auth';

export const dynamic = 'force-dynamic';

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return Response.json(data, { ...init, headers });
}

function parseId(params: { id: string }) {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('无效的试剂编号');
  return id;
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const accessError = await requireInviteAccess(request);
  if (accessError) return accessError;

  const db = getDatabase();
  if (!db) return json({ error: '共享数据库尚未连接。' }, { status: 503 });

  try {
    await ensureSeeded(db);
    const id = parseId(await context.params);
    const existing = await getReagentById(db, id, true);
    if (!existing?.deletedAt) {
      return json({ error: '回收站中不存在这条试剂记录。' }, { status: 404 });
    }
    const user = getRequestUser(request);
    const deleted = await permanentlyDeleteReagent(db, id);
    if (!deleted) return json({ error: '彻底删除失败，请稍后重试。' }, { status: 409 });
    await recordActivity(db, {
      action: '彻底删除',
      reagentId: existing.id,
      reagentName: existing.name,
      user,
      summary: '从回收站永久删除',
    });
    return json({ deleted: true, permanent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '彻底删除试剂失败';
    return json({ error: message }, { status: 400 });
  }
}
