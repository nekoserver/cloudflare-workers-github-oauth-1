/**
 * WASM ノードの起動失敗時の回復判定(SPEC.cloudflare-workers-github-oauth-1.tailscale-wasm.recovery)。
 *
 * 仮説: 永続化したノード状態(tailnet_state)が壊れていると、Go の再起動だけでは毎回同じ
 * 壊れた状態を読み直して起動に失敗し続け、DO の全経路が 503(tailscale_wasm_unavailable)に
 * なる。回復は「その状態を1回だけ破棄して初回参加をやり直す」ことで、破棄のループは
 * 破棄済みフィンガープリントとの照合で防ぐ。
 */
import { describe, expect, it } from 'vitest';
import { decideBootRecovery, fingerprintState } from './nodeBootRecovery';

describe('fingerprintState', () => {
  it('同じ状態には同じフィンガープリントを返す(順序に依らない)', () => {
    const a = fingerprintState([['k1', 'v1'], ['k2', 'v2']]);
    const b = fingerprintState([['k2', 'v2'], ['k1', 'v1']]);
    expect(a).toBe(b);
  });

  it('状態が変わればフィンガープリントも変わる', () => {
    const a = fingerprintState([['k1', 'v1']]);
    const b = fingerprintState([['k1', 'v2']]);
    const c = fingerprintState([['k1', 'v1'], ['k2', 'v2']]);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('フィンガープリントに状態の内容を含まない', () => {
    const secret = 'tskey-state-secret-marker';
    const fp = fingerprintState([['node', secret]]);
    expect(fp).not.toContain(secret);
    expect(fp).not.toContain('node');
  });
});

describe('decideBootRecovery', () => {
  it('状態があり、まだ破棄していない状態なら、破棄してやり直す', () => {
    expect(decideBootRecovery({ stateFingerprint: '10:abcd', lastDiscardedFingerprint: null })).toBe('discard-and-retry');
  });

  it('前に別の状態を破棄していても、新しい状態なら破棄してよい', () => {
    expect(decideBootRecovery({ stateFingerprint: '12:ef01', lastDiscardedFingerprint: '10:abcd' })).toBe('discard-and-retry');
  });

  it('破棄済みの状態と同じなら、二度と破棄しない', () => {
    expect(decideBootRecovery({ stateFingerprint: '10:abcd', lastDiscardedFingerprint: '10:abcd' })).toBe('fail');
  });

  it('状態が無ければ、破棄せず失敗にする', () => {
    expect(decideBootRecovery({ stateFingerprint: null, lastDiscardedFingerprint: null })).toBe('fail');
    expect(decideBootRecovery({ stateFingerprint: null, lastDiscardedFingerprint: '10:abcd' })).toBe('fail');
  });
});
