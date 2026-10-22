import { expect, it, vi } from 'vitest';
import { recordFirewallSnapshot } from './cfContainerFirewallSnapshot';
function database() {
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn().mockReturnValue({ run });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { db: { prepare } as unknown as D1Database, prepare, bind, run };
}
it('stores IPv6, CIDR, PTR and WHOIS in one idempotent hourly row', async () => {
  const d = database();
  const snapshot = { available: true, mode: 'counters-only', sources: [{ ip: '2001:db8::1', hostname: ['example.test'], packets: 5, bytes: 400, allocationCidrs: ['2001:db8::/32'] }], prefixTotals: [{ cidr: '2001:db8::/64', packets: 5 }] };
  await recordFirewallSnapshot(d.db, async () => snapshot, new Date('2026-10-21T12:05:00Z'));
  expect(d.prepare).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT(container_name, hour_utc)'));
  expect(d.bind).toHaveBeenCalledWith('nekoroot', '2026-10-21T12', '2026-10-21T12:05:00.000Z', 1, JSON.stringify(snapshot));
  expect(d.run).toHaveBeenCalledOnce();
});
it('stores a collection failure instead of pretending zero traffic', async () => {
  const d = database();
  await recordFirewallSnapshot(d.db, async () => { throw new Error('timeout'); });
  expect(d.bind.mock.calls[0][3]).toBe(0);
  expect(JSON.parse(d.bind.mock.calls[0][4])).toEqual({ available: false, error: 'timeout' });
});
it('rejects generic JSON from an old image without the firewall endpoint', async () => {
  const d = database();
  await recordFirewallSnapshot(d.db, async () => ({ message: 'demo container' }));
  expect(JSON.parse(d.bind.mock.calls[0][4])).toEqual({ available: false, error: 'invalid_firewall_snapshot' });
});
