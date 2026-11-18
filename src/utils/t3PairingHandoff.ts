export type T3PairingResponse = { ok?: boolean; pairUrl?: unknown; expiresAt?: unknown; errorCode?: string; detail?: string; remedy?: string };

/** Shared one-time T3 login link handoff used by /cf-containers and the Tailscale WASM page. */
export async function requestT3PairingHandoff(fetchContainer: (request: Request) => Promise<Response>): Promise<Response> {
  try {
    const response = await fetchContainer(new Request('http://container/t3/pairing', { method: 'POST' }));
    const data = await response.json() as T3PairingResponse;
    const pairUrl = typeof data?.pairUrl === 'string' ? data.pairUrl : '';
    let validUrl = false;
    try {
      const parsed = new URL(pairUrl);
      validUrl = parsed.origin === 'https://t3.nekomaneki.work' && parsed.pathname === '/pair' && parsed.hash.startsWith('#token=');
    } catch { /* Malformed handoff links are rejected. */ }
    if (response.ok && data?.ok === true && validUrl && typeof data.expiresAt === 'string') return Response.json({ ok: true, pairUrl, expiresAt: data.expiresAt });
    return Response.json({ ok: false, errorCode: data?.errorCode ?? 'pairing_failed', detail: data?.detail ?? 'HTTP ' + response.status, remedy: data?.remedy ?? '' }, { status: 502 });
  } catch (error) {
    return Response.json({ ok: false, errorCode: 'container_unreachable', detail: error instanceof Error ? error.message : String(error), remedy: '本体demoコンテナが起動していないか、応答していません。' }, { status: 502 });
  }
}
