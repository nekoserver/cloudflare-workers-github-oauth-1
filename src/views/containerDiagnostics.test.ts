import { expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getContainerDiagnosticsPage } from './containerDiagnostics';
it('shows history, IPv6/CIDR details and health without injecting WHOIS HTML', async () => {
  const request = vi.fn(async (input: string) => {
    const body = input.includes('/history?') ? { rows: [{ id: 9, collected_at: '2026-10-21T12:05:00Z', available: 1, mode: 'counters-only', source_count: 1, packets: 9, bytes: 900 }], nextBefore: null }
      : input.endsWith('/history/9') ? { collectedAt: '2026-10-21T12:05:00Z', snapshot: { available: true, sourceCount: 1, mode: 'counters-only', prefixTotals: [{ cidr: '2001:db8::/64', sources: 1, packets: 9, bytes: 900 }], allocationTotals: [], sources: [{ ip: '2001:db8::1', hostname: ['host.example'], allocationCidrs: ['2001:db8::/32'], packets: 9, bytes: 900, whois: '<img src=x onerror=alert(1)>' }] } }
      : { running: true, checkedAt: new Date().toISOString(), health: { apache: true, sshd: false }, firewall: { available: false, error: 'unavailable' } };
    return { ok: true, json: async () => body };
  });
  const dom = new JSDOM(getContainerDiagnosticsPage(), { url: 'https://example.com/cf-containers/diagnostics', runScripts: 'dangerously', beforeParse(w) { w.fetch = request as unknown as typeof w.fetch; w.AbortSignal = AbortSignal as unknown as typeof w.AbortSignal; } });
  try {
    const doc = dom.window.document;
    await vi.waitFor(() => expect(doc.getElementById('history')?.textContent).toContain('900'));
    expect(request).toHaveBeenCalledTimes(1);
    (doc.querySelector('#history button') as unknown as HTMLButtonElement).click();
    await vi.waitFor(() => expect(doc.getElementById('detail-body')?.textContent).toContain('2001:db8::/64'));
    expect(doc.getElementById('detail-body')?.textContent).toContain('host.example');
    expect(doc.getElementById('detail-body')?.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(doc.querySelector('#detail-body img')).toBeNull();
    (doc.getElementById('refresh-live') as unknown as HTMLButtonElement).click();
    await vi.waitFor(() => expect(doc.getElementById('health')?.textContent).toContain('応答なし'));
    expect(doc.getElementById('live-firewall')?.textContent).toContain('unavailable');
  } finally { dom.window.close(); }
});
it('distinguishes a database error from an empty history', async () => {
  const dom = new JSDOM(getContainerDiagnosticsPage(), { url: 'https://example.com', runScripts: 'dangerously', beforeParse(w) { w.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '履歴データベースを準備してください' }) }); w.AbortSignal = AbortSignal as unknown as typeof w.AbortSignal; } });
  try { await vi.waitFor(() => expect(dom.window.document.getElementById('history-status')?.textContent).toContain('履歴データベースを準備してください')); }
  finally { dom.window.close(); }
});
