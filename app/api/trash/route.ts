import {
  ensureSeeded,
  getDatabase,
  listDeletedReagents,
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

export async function GET(request: Request) {
  const accessError = await requireInviteAccess(request);
  if (accessError) return accessError;

  const db = getDatabase();
  if (!db) return json(request, { reagents: [], count: 0, persistence: false });

  try {
    await ensureSeeded(db);
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get('limit') ?? 200);
    const reagents = await listDeletedReagents(db, requestedLimit);
    return json(request, {
      reagents,
      count: reagents.length,
      persistence: true,
    });
  } catch (error) {
    console.error('Failed to read reagent trash', error);
    return json(
      request,
      { error: '回收站暂时不可用，请稍后重试。' },
      { status: 503 },
    );
  }
}

export function OPTIONS(request: Request) {
  return preflightResponse(request);
}
