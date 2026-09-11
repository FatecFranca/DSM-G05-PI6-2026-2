import { apiUrl } from '@/lib/server-auth';

const allowed = new Map([
  ['auth/config', 'GET'], ['auth/me', 'GET'], ['auth/login', 'POST'],
  ['auth/register', 'POST'], ['auth/logout', 'POST'], ['auth/forgot-password', 'POST'],
  ['auth/reset-password', 'POST'], ['auth/change-password', 'POST'],
  ['dashboard/summary', 'GET'], ['products', 'GET'], ['forecasts', 'GET'], ['sync-runs', 'GET'],
]);

async function proxy(request, context) {
  const { path } = await context.params;
  const endpoint = path.join('/');
  if (allowed.get(endpoint) !== request.method) {
    return Response.json({ message: 'Rota não encontrada.' }, { status: 404 });
  }
  const incomingUrl = new URL(request.url);
  const headers = new Headers({ Accept: 'application/json' });
  const session = request.cookies.get('estoque_session');
  if (session) headers.set('Cookie', `estoque_session=${encodeURIComponent(session.value)}`);
  let body;
  if (request.method === 'POST') {
    if (request.headers.get('origin') !== incomingUrl.origin
      || request.headers.get('x-requested-with') !== 'EstoqueInteligente'
      || !request.headers.get('content-type')?.startsWith('application/json')) {
      return Response.json({ message: 'Origem da solicitação não permitida.' }, { status: 403 });
    }
    // Limite real de leitura, inclusive para corpos chunked sem Content-Length.
    const reader = request.body?.getReader();
    const chunks = [];
    let bytes = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 16384) {
          await reader.cancel();
          return Response.json({ message: 'Solicitação muito grande.' }, { status: 413 });
        }
        chunks.push(Buffer.from(value));
      }
    }
    body = Buffer.concat(chunks);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Requested-With', 'EstoqueInteligente');
    headers.set('Origin', incomingUrl.origin);
  }
  try {
    const upstream = await fetch(`${apiUrl}/api/v1/${endpoint}${incomingUrl.search}`, {
      method: request.method, headers, body, cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    const responseHeaders = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append('Set-Cookie', cookie);
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) responseHeaders.set('Retry-After', retryAfter);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ message: 'Não foi possível conectar ao serviço. Tente novamente em instantes.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export { proxy as GET, proxy as POST };
