import {
  ensureSeeded,
  getDatabase,
  getRequestUser,
  insertReagentsBatch,
  recordActivity,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const accessError = await requireInviteAccess(request);
  if (accessError) return accessError;

  const db = getDatabase();
  if (!db) {
    return json(request, { error: '共享数据库尚未连接。' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const importKey =
      typeof body.importKey === 'string' ? body.importKey.trim() : '';
    if (!/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(importKey)) {
      throw new Error('导入批次编号无效');
    }

    const rawReagents = body.reagents;
    if (!Array.isArray(rawReagents) || rawReagents.length === 0) {
      throw new Error('没有可导入的试剂记录');
    }
    if (rawReagents.length > 500) {
      throw new Error('单次最多导入 500 条试剂记录');
    }
    if (!rawReagents.every(isRecord)) {
      throw new Error('试剂记录格式不正确');
    }

    await ensureSeeded(db);
    const result = await insertReagentsBatch(
      db,
      rawReagents as ReagentWriteInput[],
      getRequestUser(request),
      importKey,
    );

    if (result.inserted > 0) {
      const user = getRequestUser(request);
      await recordActivity(db, {
        action: '导入',
        reagentName: '新增试剂柜',
        user,
        summary: `批量加入 ${result.inserted} 项试剂记录`,
      });
    }

    return json(
      request,
      {
        importKey,
        inserted: result.inserted,
        skipped: result.skipped,
        total: rawReagents.length,
        alreadyImported: result.alreadyImported,
      },
      { status: result.alreadyImported ? 200 : 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '批量导入失败';
    return json(request, { error: message }, { status: 400 });
  }
}

export function OPTIONS(request: Request) {
  return preflightResponse(request);
}
