// Vercel serves the shared React app; the original API owns validation and D1 storage.
// Only this fixed endpoint and the workspace cookie are forwarded.
const backend = 'https://hireflow-jayesh-ats.active-seed-2151.chatgpt.site/api/candidates';
const jsonError = (error, status) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function forwardCandidates(request, fetchUpstream = fetch) {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    const response = jsonError('Method not allowed.', 405);
    response.headers.set('Allow', 'GET, POST, DELETE');
    return response;
  }
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (request.method !== 'GET' && origin && origin !== url.origin) {
    return jsonError('Invalid origin.', 403);
  }
  const target = new URL(backend);
  const id = url.searchParams.get('id');
  if (id !== null) target.searchParams.set('id', id);
  const headers = new Headers({ Accept: 'application/json' });
  const workspace = request.headers.get('cookie')?.match(/(?:^|;\s*)hireflow_workspace=([a-f0-9-]{36})(?:;|$)/i)?.[1];
  if (workspace) headers.set('Cookie', `hireflow_workspace=${workspace}`);
  let body;
  if (request.method === 'POST') {
    body = await request.text();
    if (new TextEncoder().encode(body).length > 32768) return jsonError('Candidate request is too large.', 413);
    headers.set('Content-Type', 'application/json');
  }
  try {
    const response = await fetchUpstream(target, {
      method: request.method, headers, body, cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(25000),
    });
    const outgoingHeaders = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
    const cookie = response.headers.get('set-cookie');
    if (cookie?.startsWith('hireflow_workspace=')) outgoingHeaders.set('Set-Cookie', cookie);
    return new Response(await response.text(), { status: response.status, headers: outgoingHeaders });
  } catch (error) {
    console.error('Candidate upstream request failed:', error instanceof Error ? error.message : 'Unknown error');
    return jsonError('The candidate service is temporarily unavailable. Please retry.', 502);
  }
}
