import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fetchMuseMonitor, MUSE_MONITOR_SECTIONS, signMuseMonitor } from './museMonitor';

// 対象: 本体Workerからmuse-monitor(Service Binding MUSE_MONITOR)の/api/hmac/*を呼ぶ処理。
// 署名はmuse-monitorのsrc/index.ts hmacMatchesに合わせる: X-Muse-Timestamp(UNIX秒)と
// X-Muse-Signature = hex(HMAC-SHA256(MONITOR_HMAC_SECRET, "<ts>.<section>"))。
// 故障想定: 署名の形がmuse-monitorと違う / sectionの取り違え / 鍵やバインディングが無いときに例外や
// 無意味な401になる / 鍵の不一致が「unauthorized」だけで原因が分からない / 応答がJSONでない。

const SECRET = 'shared-hmac-secret';
const NOW = Date.parse('2026-11-10T23:00:00Z');
const TS = Math.floor(NOW / 1000);

type Seen = { url: string; headers: Headers };
function fetcher(answer: (req: Request) => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const f = { fetch: async (input: RequestInfo, init?: RequestInit) => {
    const req = new Request(input, init);
    seen.push({ url: req.url, headers: req.headers });
    return answer(req);
  } } as unknown as Fetcher;
  return { f, seen };
}

describe('signMuseMonitor', () => {
  it('"<ts>.<section>"のHMAC-SHA256を小文字hexで返す', async () => {
    const expected = createHmac('sha256', SECRET).update(`${TS}.jobs`).digest('hex');
    expect(await signMuseMonitor(SECRET, 'jobs', TS)).toBe(expected);
  });
});

describe('fetchMuseMonitor', () => {
  it('statusは/api/hmac/status、それ以外は/api/hmac/monitor/<section>へ、署名付きで送る', async () => {
    const { f, seen } = fetcher(() => Response.json({ section: 'x', output: 'ok' }));
    expect(await fetchMuseMonitor(f, SECRET, 'status', NOW)).toEqual({ ok: true, status: 200, body: { section: 'x', output: 'ok' } });
    await fetchMuseMonitor(f, SECRET, 'diag', NOW);
    expect(seen.map((s) => new URL(s.url).pathname)).toEqual(['/api/hmac/status', '/api/hmac/monitor/diag']);
    expect(seen[1].headers.get('X-Muse-Timestamp')).toBe(String(TS));
    expect(seen[1].headers.get('X-Muse-Signature')).toBe(createHmac('sha256', SECRET).update(`${TS}.diag`).digest('hex'));
    expect(seen[1].headers.get('Authorization')).toBeNull();
  });

  it('muse-monitorの上流のエラー(502など)は、状態と本文をそのまま返す', async () => {
    const body = { error: 'receiver_unauthorized', message: 'm', keySource: 'TS_API_KEY' };
    const { f } = fetcher(() => Response.json(body, { status: 502 }));
    expect(await fetchMuseMonitor(f, SECRET, 'jobs', NOW)).toEqual({ ok: true, status: 502, body });
  });

  it('muse-monitorが署名を401で拒んだら、鍵の不一致として理由を返す', async () => {
    const { f } = fetcher(() => Response.json({ error: 'unauthorized' }, { status: 401 }));
    const result = await fetchMuseMonitor(f, SECRET, 'jobs', NOW);
    expect(result).toMatchObject({ ok: false, errorCode: 'hmac_rejected', status: 401 });
    expect(!result.ok && result.detail).toContain('MONITOR_HMAC_SECRET');
  });

  it('バインディングか鍵が無ければ、送らずにnot_configuredを返す', async () => {
    const { f, seen } = fetcher(() => Response.json({}));
    expect(await fetchMuseMonitor(undefined, SECRET, 'jobs', NOW)).toMatchObject({ ok: false, errorCode: 'not_configured', detail: expect.stringContaining('MUSE_MONITOR') });
    expect(await fetchMuseMonitor(f, '', 'jobs', NOW)).toMatchObject({ ok: false, errorCode: 'not_configured', detail: expect.stringContaining('MONITOR_HMAC_SECRET') });
    expect(seen).toEqual([]);
  });

  it('一覧に無いsectionは送らない', async () => {
    const { f, seen } = fetcher(() => Response.json({}));
    for (const s of ['exec', '', '../status', 'JOBS']) {
      expect(await fetchMuseMonitor(f, SECRET, s, NOW)).toMatchObject({ ok: false, errorCode: 'unknown_section' });
    }
    expect(seen).toEqual([]);
  });

  it('通信の失敗とJSONでない応答は理由付きで返す', async () => {
    const thrown = fetcher(() => { throw new Error('binding down'); });
    expect(await fetchMuseMonitor(thrown.f, SECRET, 'jobs', NOW)).toMatchObject({ ok: false, errorCode: 'transport_error', detail: expect.stringContaining('binding down') });
    const html = fetcher(() => new Response('<html>error 1042</html>', { status: 404 }));
    expect(await fetchMuseMonitor(html.f, SECRET, 'jobs', NOW)).toMatchObject({ ok: false, errorCode: 'invalid_response', status: 404, detail: expect.stringContaining('error 1042') });
  });

  it('sectionの一覧はmuse-monitorと同じ15個', () => {
    expect([...MUSE_MONITOR_SECTIONS].sort()).toEqual(['diag', 'execlog', 'git', 'jobs', 'pending', 'pkgs', 'ports', 'procs', 'recent', 'sdkhealth', 'sdkprofiles', 'sdksessions', 'sdkts', 'status', 'vm']);
  });
});
