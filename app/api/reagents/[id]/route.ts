import {
  deleteReagent,
  ensureSeeded,
  getDatabase,
  getRequestUser,
  updateReagent,
  type ReagentWriteInput,
} from '@/lib/reagent-db';
import { requireInviteAccess } from '@/lib/invite-auth';

export const dynamic = 'force-dynamic';

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return Response.json(data, {
    ...init,
    headers,
  });
}

function parseId(params: { id: string }) {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('无效的试剂编号');
  return id;
}

export async function PATCH(
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
    const input = (await request.json()) as ReagentWriteInput;
    const reagent = await updateReagent(
      db,
      id,
      input,
      getRequestUser(request),
    );
    if (!reagent) return json({ error: '试剂不存在或已被删除。' }, { status: 404 });
    return json({ reagent });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新试剂失败';
    return json({ error: message }, { status: 400 });
  }
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
    const deleted = await deleteReagent(db, id);
    if (!deleted) return json({ error: '试剂不存在或已被删除。' }, { status: 404 });
    return json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除试剂失败';
    return json({ error: message }, { status: 400 });
  }
}
