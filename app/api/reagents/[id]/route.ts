import {
  ensureSeeded,
  getDatabase,
  getReagentById,
  getRequestUser,
  moveReagentToTrash,
  recordActivity,
  updateReagent,
  type ReagentWriteInput,
} from '@/lib/reagent-db';
import { requireInviteAccess } from '@/lib/invite-auth';
import { addCorsHeaders, preflightResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

function json(request: Request, data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return Response.json(data, {
    ...init,
    headers: addCorsHeaders(request, headers),
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
  if (!db)
    return json(request, { error: '共享数据库尚未连接。' }, { status: 503 });

  try {
    await ensureSeeded(db);
    const id = parseId(await context.params);
    const input = (await request.json()) as ReagentWriteInput;
    const user = getRequestUser(request);
    const reagent = await updateReagent(db, id, input, user);
    if (!reagent)
      return json(
        request,
        { error: '试剂不存在或已被删除。' },
        { status: 404 },
      );
    await recordActivity(db, {
      action: '编辑',
      reagentId: reagent.id,
      reagentName: reagent.name,
      user,
      summary: `更新试剂信息 · ${reagent.location} · ${reagent.storageTemp}`,
    });
    return json(request, { reagent });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新试剂失败';
    return json(request, { error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const accessError = await requireInviteAccess(request);
  if (accessError) return accessError;

  const db = getDatabase();
  if (!db)
    return json(request, { error: '共享数据库尚未连接。' }, { status: 503 });

  try {
    await ensureSeeded(db);
    const id = parseId(await context.params);
    const user = getRequestUser(request);
    const existing = await getReagentById(db, id);
    const deleted = await moveReagentToTrash(db, id, user);
    if (!deleted)
      return json(
        request,
        { error: '试剂不存在或已在回收站。' },
        { status: 404 },
      );
    if (existing) {
      await recordActivity(db, {
        action: '移入回收站',
        reagentId: existing.id,
        reagentName: existing.name,
        user,
        summary: `移入回收站 · ${existing.location}`,
      });
    }
    return json(request, { deleted: true, trashed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除试剂失败';
    return json(request, { error: message }, { status: 400 });
  }
}

export function OPTIONS(request: Request) {
  return preflightResponse(request);
}
