const ALLOWED_ORIGINS = new Set([
  'https://cpu-tian-group.github.io',
  'https://cputianlab.cn',
]);

function isAllowedOrigin(origin: string | null) {
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

export function addCorsHeaders(request: Request, source?: HeadersInit) {
  const headers = new Headers(source);
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(origin)) return headers;

  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS',
  );
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '600');
  headers.set('Vary', 'Origin');
  return headers;
}

export function corsResponse(request: Request, response: Response) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: addCorsHeaders(request, response.headers),
  });
}

export function preflightResponse(request: Request) {
  return new Response(null, {
    status: 204,
    headers: addCorsHeaders(request),
  });
}
