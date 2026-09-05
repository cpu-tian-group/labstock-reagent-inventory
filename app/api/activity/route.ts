import {
  ensureSeeded,
  getDatabase,
  listActivities,
} from '@/lib/reagent-db';
import { requireInviteAccess } from '@/lib/invite-auth';

export const dynamic = 'force-dynamic';

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return Response.json(data, { ...init, headers });
}

export async function GET(request: Request) {
  const accessError = await requireInviteAccess(request);
  if (accessError) return accessError;

  const db = getDatabase();
  if (!db) return json({ activities: [], persistence: false });

  try {
    await ensureSeeded(db);
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get('limit') ?? 100);
    return json({
      activities: await listActivities(db, requestedLimit),
      persistence: true,
    });
  } catch (error) {
    console.error('Failed to read reagent activity', error);
    return json(
      { error: '操作记录暂时不可用，请稍后重试。' },
      { status: 503 },
    );
  }
}
