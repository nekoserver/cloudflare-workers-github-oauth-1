/**
 * /cf-containers の tailscale ノード ヘルスチェック欄の要約
 * (SPEC.cloudflare-workers-github-oauth-1.tailscale-wasm.recovery REQ-TW-015)。
 *
 * 要点: DO への取得が失敗したときは、その失敗自体を欄の状態(unavailable)として
 * 表すこと。ログイン URL は要約に含めない(待ちの有無だけ)。
 */
import { describe, expect, it } from 'vitest';
import { summarizeTailnetHealth } from './tailscaleNodeHealth';

const base = { configured: true, doError: null, status: null, bootEvents: [], checkedAt: '2026-11-18T00:00:00.000Z' };

describe('summarizeTailnetHealth', () => {
  it('Running で muse-vm がオンラインなら running', () => {
    const s = summarizeTailnetHealth({ ...base, status: { state: 'Running', peers: [{ name: 'muse-vm', online: true }, { name: 'ipad', online: false }] } });
    expect(s.kind).toBe('running');
    expect(s.nodeState).toBe('Running');
    expect(s.museOnline).toBe(true);
    expect(s.peerCount).toBe(2);
    expect(s.loginPending).toBe(false);
  });

  it('Running でも muse-vm が居なければ museOnline は false', () => {
    const s = summarizeTailnetHealth({ ...base, status: { state: 'Running', peers: [{ dnsName: 'other.example.ts.net', online: true }] } });
    expect(s.kind).toBe('running');
    expect(s.museOnline).toBe(false);
  });

  it('NeedsLogin は needs_login、ログイン URL があっても要約に含めない', () => {
    const s = summarizeTailnetHealth({ ...base, status: { state: 'NeedsLogin', peers: [], loginURL: 'https://login.tailscale.com/a/secret' } });
    expect(s.kind).toBe('needs_login');
    expect(s.loginPending).toBe(true);
    expect(JSON.stringify(s)).not.toContain('login.tailscale.com');
  });

  it('DO への取得が失敗したら unavailable(エラー文言を保持)', () => {
    const s = summarizeTailnetHealth({ ...base, doError: 'tailscale_wasm_unavailable' });
    expect(s.kind).toBe('unavailable');
    expect(s.doError).toBe('tailscale_wasm_unavailable');
    expect(s.nodeState).toBeNull();
  });

  it('バインディングが無ければ not_configured', () => {
    const s = summarizeTailnetHealth({ ...base, configured: false });
    expect(s.kind).toBe('not_configured');
  });

  it('起動記録は直近分をそのまま渡し、最新を lastBootEvent にする', () => {
    const events = [
      { event: 'state_discarded', fingerprint: '12:abcd', reason: 'Error: startup failed', created_at: '2026-11-18T00:01:00Z' },
      { event: 'boot_failed', fingerprint: '12:abcd', reason: 'Error: startup failed', created_at: '2026-11-18T00:00:00Z' },
    ];
    const s = summarizeTailnetHealth({ ...base, doError: 'tailscale_wasm_unavailable', bootEvents: events });
    expect(s.bootEvents).toHaveLength(2);
    expect(s.lastBootEvent?.event).toBe('state_discarded');
  });

  it('状態が読めなければ unknown', () => {
    const s = summarizeTailnetHealth({ ...base, status: { state: 42 } });
    expect(s.kind).toBe('unknown');
  });
});
