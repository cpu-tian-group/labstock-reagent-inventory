import { ensureSeeded, getDatabase, listActivities } from '@/lib/reagent-db';
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

export async function GET(request: Request) {
  const accessError = await requireInviteAccess(request);
  if (accessError) return accessError;

  const db = getDatabase();
  if (!db) return json(request, { activities: [], persistence: false });

  try {
    await ensureSeeded(db);
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get('limit') ?? 100);
    return json(request, {
      activities: await listActivities(db, requestedLimit),
      persistence: true,
    });
  } catch (error) {
    console.error('Failed to read reagent activity', error);
    return json(
      request,
      { error: '操作记录暂时不可用，请稍后重试。' },
      { status: 503 },
    );
  }
}

export function OPTIONS(request: Request) {
  return preflightResponse(request);
}
