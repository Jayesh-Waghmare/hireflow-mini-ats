import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forwardCandidates } from '../lib/vercel-proxy.mjs';
import entry from '../api/candidates.mjs';

test('Vercel runtime context is not mistaken for the upstream fetch function', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('[]');
    const response = await entry.fetch(new Request('https://hireflow.vercel.app/api/candidates'), { waitUntil() {} });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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

test('workspace cookie stays separate from upstream infrastructure cookies', async () => {
  const workspace = 'hireflow_workspace=12345678-1234-1234-1234-123456789012; Path=/; Expires=Sun, 17 Oct 2027 12:00:00 GMT; HttpOnly; Secure; SameSite=Lax';
  for (const combined of [false, true]) {
    const headers = new Headers();
    if (combined) {
      headers.set('Set-Cookie', workspace + ', __cf_bm=upstream-only; Domain=chatgpt.site; Secure; SameSite=None');
    } else {
      headers.append('Set-Cookie', '__cf_bm=upstream-only; Domain=chatgpt.site; Secure');
      headers.append('Set-Cookie', workspace);
    }
    const response = await forwardCandidates(new Request('https://hireflow.vercel.app/api/candidates'), async () => new Response('[]', { headers }));
    assert.equal(response.headers.get('Set-Cookie'), workspace);
    assert.doesNotMatch(response.headers.get('Set-Cookie'), /__cf_bm|Domain=/);
  }
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
