import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forwardCandidates } from '../lib/vercel-proxy.mjs';

test('Vercel initializes a workspace without caching or leaking unrelated cookies', async () => {
  let sent;
  const response = await forwardCandidates(new Request('https://hireflow.vercel.app/api/candidates', {
    headers: { Cookie: 'unrelated_secret=hidden; hireflow_workspace=12345678-1234-1234-1234-123456789012' },
  }), async (url, options) => {
    sent = { url, options };
    return new Response('[]', { headers: { 'Set-Cookie': 'hireflow_workspace=12345678-1234-1234-1234-123456789012; Path=/; HttpOnly; Secure; SameSite=Lax' } });
  });
  assert.equal(sent.url.pathname, '/api/candidates');
  assert.equal(sent.options.headers.get('Cookie'), 'hireflow_workspace=12345678-1234-1234-1234-123456789012');
  assert.equal(sent.options.headers.has('Origin'), false);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.match(response.headers.get('Set-Cookie'), /HttpOnly/);
  assert.deepEqual(await response.json(), []);
});

test('Vercel blocks foreign browser writes, unsupported methods, and oversized payloads', async () => {
  const unreachable = () => { throw Error('Upstream must not be called'); };
  assert.equal((await forwardCandidates(new Request('https://hireflow.vercel.app/api/candidates', { method: 'POST', headers: { Origin: 'https://foreign.example' }, body: '{}' }), unreachable)).status, 403);
  assert.equal((await forwardCandidates(new Request('https://hireflow.vercel.app/api/candidates', { method: 'PUT' }), unreachable)).status, 405);
  assert.equal((await forwardCandidates(new Request('https://hireflow.vercel.app/api/candidates', { method: 'POST', body: 'x'.repeat(32769) }), unreachable)).status, 413);
});

test('Vercel preserves API errors and reports upstream outages', async () => {
  let sent;
  const result = await forwardCandidates(new Request('https://hireflow.vercel.app/api/candidates?id=abc', { method: 'DELETE' }), async (url) => {
    sent = url; return Response.json({ error: 'Candidate not found.' }, { status: 404 });
  });
  assert.equal(sent.searchParams.get('id'), 'abc');
  assert.equal(result.status, 404);
  const offline = await forwardCandidates(new Request('https://hireflow.vercel.app/api/candidates'), async () => { throw Error('offline'); });
  assert.equal(offline.status, 502);
});
