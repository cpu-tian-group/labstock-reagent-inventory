import {
  clearSessionCookie,
  createInviteSession,
  hasInviteAccess,
  sessionCookie,
  validateInviteCode,
} from '@/lib/invite-auth';

export const dynamic = 'force-dynamic';

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return Response.json(data, { ...init, headers });
}

export async function GET(request: Request) {
  return json({ authenticated: await hasInviteAccess(request) });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: unknown };
    if (!(await validateInviteCode(body.code))) {
      return json({ error: '邀请码不正确，请联系课题组负责人。' }, { status: 401 });
    }
    const value = await createInviteSession();
    if (!value) return json({ error: '邀请码服务暂时不可用。' }, { status: 503 });
    const response = json({ authenticated: true });
    response.headers.set('Set-Cookie', sessionCookie(value));
    return response;
  } catch {
    return json({ error: '邀请码格式不正确。' }, { status: 400 });
  }
}

export async function DELETE() {
  const response = json({ authenticated: false });
  response.headers.set('Set-Cookie', clearSessionCookie());
  return response;
}
