import { env } from 'cloudflare:workers';

const SESSION_COOKIE = 'labstock_access';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function runtimeInviteCode() {
  return (env as unknown as { LABSTOCK_INVITE_CODE?: string })
    .LABSTOCK_INVITE_CODE?.trim() ?? '';
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function digest(value: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
}

async function signSession(payload: string) {
  const secret = runtimeInviteCode();
  if (!secret) return null;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(signature);
}

async function isSameCode(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all([
    digest(left),
    digest(right),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function getCookie(request: Request) {
  const cookies = request.headers.get('Cookie') ?? '';
  const entry = cookies
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
  return entry?.slice(SESSION_COOKIE.length + 1) ?? null;
}

export async function hasInviteAccess(request: Request) {
  const inviteCode = runtimeInviteCode();
  const cookie = getCookie(request);
  if (!inviteCode || !cookie) return false;

  try {
    const [encodedPayload, encodedSignature] = cookie.split('.');
    if (!encodedPayload || !encodedSignature) return false;
    const payload = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const [issuedAt] = payload.split('|');
    const issuedAtNumber = Number(issuedAt);
    if (!Number.isFinite(issuedAtNumber)) return false;
    if (Date.now() - issuedAtNumber > SESSION_MAX_AGE * 1000) return false;
    if (Date.now() < issuedAtNumber - 60 * 1000) return false;
    const expectedSignature = await signSession(payload);
    if (!expectedSignature) return false;
    return expectedSignature === encodedSignature;
  } catch {
    return false;
  }
}

export async function createInviteSession() {
  if (!runtimeInviteCode()) return null;
  const payload = `${Date.now()}|${crypto.randomUUID()}`;
  const signature = await signSession(payload);
  if (!signature) return null;
  const encodedPayload = toBase64Url(new TextEncoder().encode(payload));
  return `${encodedPayload}.${signature}`;
}

export function sessionCookie(value: string) {
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function validateInviteCode(value: unknown) {
  const inviteCode = runtimeInviteCode();
  return (
    typeof value === 'string' &&
    Boolean(inviteCode) &&
    (await isSameCode(value.trim(), inviteCode))
  );
}

export async function requireInviteAccess(request: Request) {
  if (await hasInviteAccess(request)) return null;
  return Response.json(
    { error: '请先输入课题组邀请码。' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}
