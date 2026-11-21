// 本体Workerからmuse-monitor(読み取り専用のMuseシステムモニタWorker)を呼ぶ。
// *.workers.dev同士の直接fetch()はerror code: 1042で拒否されるため、Service Binding(MUSE_MONITOR)を使う。
// 認証はmuse-monitor側(src/index.ts hmacMatches)が定める形に合わせる:
//   X-Muse-Timestamp: UNIX秒、X-Muse-Signature: hex(HMAC-SHA256(MONITOR_HMAC_SECRET, "<ts>.<経路>.<section>"))、±300秒
// 署名は経路に束縛される(REQ-SEC-066): ある経路のために作った署名は、別の経路では通用しない。
// 鍵の値はどこにも出さない。

export const MUSE_MONITOR_SECTIONS = [
  'status', 'diag', 'jobs', 'pkgs', 'vm', 'procs', 'ports', 'git', 'recent',
  'pending', 'execlog', 'sdkhealth', 'sdkprofiles', 'sdksessions', 'sdkts',
] as const;
export type MuseMonitorSection = (typeof MUSE_MONITOR_SECTIONS)[number];

export type MuseMonitorErrorCode = 'not_configured' | 'unknown_section' | 'hmac_rejected' | 'transport_error' | 'invalid_response';
export type MuseMonitorResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; errorCode: MuseMonitorErrorCode; detail: string; status?: number };

const SECTION_SET: ReadonlySet<string> = new Set(MUSE_MONITOR_SECTIONS);

export async function signMuseMonitor(secret: string, route: string, section: string, ts: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}.${route}.${section}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function fetchMuseMonitor(
  fetcher: Fetcher | undefined,
  secret: string | undefined,
  section: string,
  now: number = Date.now(),
): Promise<MuseMonitorResult> {
  if (!fetcher) return { ok: false, errorCode: 'not_configured', detail: 'Service Binding MUSE_MONITOR(muse-monitor)が未設定です' };
  if (!secret) return { ok: false, errorCode: 'not_configured', detail: 'MONITOR_HMAC_SECRETが未設定です(muse-monitorと同じ値をwrangler secret putで設定)' };
  if (!SECTION_SET.has(section)) return { ok: false, errorCode: 'unknown_section', detail: `未知のsectionです: ${section.slice(0, 40)}` };

  const ts = Math.floor(now / 1000);
  const path = section === 'status' ? '/api/hmac/status' : `/api/hmac/monitor/${section}`;
  let response: Response;
  try {
    response = await fetcher.fetch(`https://muse-monitor${path}`, {
      headers: { 'X-Muse-Timestamp': String(ts), 'X-Muse-Signature': await signMuseMonitor(secret, path, section, ts) },
    });
  } catch (error) {
    return { ok: false, errorCode: 'transport_error', detail: `muse-monitorへ送れませんでした: ${error instanceof Error ? error.message : String(error)}` };
  }
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, errorCode: 'invalid_response', status: response.status, detail: `muse-monitorの応答がJSONではありません(HTTP ${response.status}): ${text.slice(0, 200)}` };
  }
  // muse-monitorの401は、本体の署名を拒んだときだけ返る(上流の401はreceiver_unauthorizedとして別の形で返る)。
  if (response.status === 401 && (body as { error?: unknown } | null)?.error === 'unauthorized') {
    return { ok: false, errorCode: 'hmac_rejected', status: 401, detail: 'muse-monitorが署名を拒否しました。本体とmuse-monitorのMONITOR_HMAC_SECRETが同じ値か、時刻が±300秒以内かを確かめてください' };
  }
  return { ok: true, status: response.status, body };
}
