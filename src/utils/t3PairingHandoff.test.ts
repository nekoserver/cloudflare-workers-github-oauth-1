import { expect, it, vi } from 'vitest';
import { requestT3PairingHandoff } from './t3PairingHandoff';

it('uses the shared one-time T3 pairing endpoint and returns the validated handoff link', async () => {
  const fetch = vi.fn(async (request: Request) => {
    expect(request.method).toBe('POST');
    expect(new URL(request.url).pathname).toBe('/t3/pairing');
    return Response.json({ ok: true, pairUrl: 'https://t3.nekomaneki.work/pair#token=secret-once', expiresAt: 'soon' });
  });
  const response = await requestT3PairingHandoff(fetch);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, pairUrl: 'https://t3.nekomaneki.work/pair#token=secret-once', expiresAt: 'soon' });
});

it('rejects an off-site token URL and reports the existing container errors', async () => {
  const badUrl = await requestT3PairingHandoff(async () => Response.json({ ok: true, pairUrl: 'https://evil.example/pair#token=secret', expiresAt: 'soon' }));
  expect(badUrl.status).toBe(502);
  expect(await badUrl.json()).toMatchObject({ ok: false, errorCode: 'pairing_failed' });
  const failure = await requestT3PairingHandoff(async () => Response.json({ ok: false, errorCode: 'cli_failed', detail: 'T3 down', remedy: 'check T3' }, { status: 502 }));
  expect(await failure.json()).toMatchObject({ errorCode: 'cli_failed', detail: 'T3 down', remedy: 'check T3' });
  const offline = await requestT3PairingHandoff(async () => { throw new Error('container down'); });
  expect(await offline.json()).toMatchObject({ errorCode: 'container_unreachable', detail: 'container down' });
});
