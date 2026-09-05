import {
  ensureSeeded,
  getDatabase,
  getRequestUser,
  getSeedReagents,
  insertReagent,
  listReagents,
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

export async function GET(request: Request) {
  const accessError = await requireInviteAccess(request);
  if (accessError) return accessError;

  const db = getDatabase();
  if (!db) {
    return json({
      reagents: getSeedReagents(),
      persistence: false,
      message: '当前预览环境没有连接共享数据库。',
    });
  }

  try {
    await ensureSeeded(db);
    return json({ reagents: await listReagents(db), persistence: true });
  } catch (error) {
    console.error('Failed to read reagent inventory', error);
    return json(
      { error: '共享试剂库暂时不可用，请稍后重试。' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const accessError = await requireInviteAccess(request);
  if (accessError) return accessError;

  const db = getDatabase();
  if (!db) {
    return json({ error: '共享数据库尚未连接。' }, { status: 503 });
  }

  try {
    await ensureSeeded(db);
    const input = (await request.json()) as ReagentWriteInput;
    const reagent = await insertReagent(db, input, getRequestUser(request));
    if (!reagent) throw new Error('试剂保存后无法读取');
    return json({ reagent }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存试剂失败';
    return json({ error: message }, { status: 400 });
  }
}
