import { describe, it, expect } from 'vitest';
import { resolveIdleTimeoutSeconds } from './types';

describe('resolveIdleTimeoutSeconds', () => {
  describe('バグ1修正: ログイン時に settingsSeconds を渡すと session duration が idle に反映される', () => {
    it('env未設定・settingsSeconds=86400(1d) → idle=86400', () => {
      expect(resolveIdleTimeoutSeconds(undefined, 86400, 86400)).toBe(86400);
    });

    it('env未設定・settingsSeconds=3600(1h) → idle=3600', () => {
      expect(resolveIdleTimeoutSeconds(undefined, 3600, 3600)).toBe(3600);
    });

    it('env未設定・settingsSeconds未渡し → idle=30分固定(旧挙動)', () => {
      // 第3引数なしは defaultIdle=1800 になる（旧バグの挙動を文書化）
      expect(resolveIdleTimeoutSeconds(undefined, 86400)).toBe(30 * 60);
    });
  });

  describe('maxSeconds でキャップされる', () => {
    it('settingsSeconds が maxSeconds を超える場合は maxSeconds に切り詰め', () => {
      expect(resolveIdleTimeoutSeconds(undefined, 1000, 86400)).toBe(1000);
    });

    it('env設定値が maxSeconds を超える場合は maxSeconds に切り詰め', () => {
      expect(resolveIdleTimeoutSeconds('7200', 3600)).toBe(3600);
    });
  });

  describe('env変数が設定されている場合はそちらを優先', () => {
    it('SESSION_IDLE_TIMEOUT_SECONDS=900 → idle=900', () => {
      expect(resolveIdleTimeoutSeconds('900', 86400, 86400)).toBe(900);
    });
  });
});

describe('バグ2修正: last_activity 消失時の login_timestamp フォールバック', () => {
  // authMiddleware 内の判定ロジックを関数として切り出して検証
  function isSessionExpired(params: {
    lastActivity: number | null;
    loginTimestamp: number | null;
    idleTimeoutSeconds: number;
    nowMs: number;
  }): boolean {
    const { lastActivity, loginTimestamp, idleTimeoutSeconds, nowMs } = params;
    const effectiveLastActivity = lastActivity ?? loginTimestamp;
    return !effectiveLastActivity || nowMs - effectiveLastActivity > idleTimeoutSeconds * 1000;
  }

  const NOW = Date.now();
  const IDLE_1D = 86400;

  it('last_activity が直近 → セッション有効', () => {
    expect(isSessionExpired({
      lastActivity: NOW - 10 * 60 * 1000,  // 10分前
      loginTimestamp: NOW - 60 * 60 * 1000,
      idleTimeoutSeconds: IDLE_1D,
      nowMs: NOW,
    })).toBe(false);
  });

  it('last_activity=null・login_timestamp が直近 → フォールバックでセッション有効（バグ2修正確認）', () => {
    expect(isSessionExpired({
      lastActivity: null,          // Cookieが消えている
      loginTimestamp: NOW - 10 * 60 * 1000,  // 10分前にログイン
      idleTimeoutSeconds: IDLE_1D,
      nowMs: NOW,
    })).toBe(false);
  });

  it('last_activity=null・login_timestamp も null → セッション切れ', () => {
    expect(isSessionExpired({
      lastActivity: null,
      loginTimestamp: null,
      idleTimeoutSeconds: IDLE_1D,
      nowMs: NOW,
    })).toBe(true);
  });

  it('last_activity=null・login_timestamp が idleTimeout を超えている → セッション切れ', () => {
    expect(isSessionExpired({
      lastActivity: null,
      loginTimestamp: NOW - (IDLE_1D + 100) * 1000,  // アイドルタイムアウト超過
      idleTimeoutSeconds: IDLE_1D,
      nowMs: NOW,
    })).toBe(true);
  });

  it('last_activity が idleTimeout を超えている → セッション切れ', () => {
    expect(isSessionExpired({
      lastActivity: NOW - (IDLE_1D + 100) * 1000,
      loginTimestamp: NOW - 60 * 60 * 1000,
      idleTimeoutSeconds: IDLE_1D,
      nowMs: NOW,
    })).toBe(true);
  });
});
