import { describe, it, expect } from 'vitest';
import {
  API_KEY_PREFIX,
  generateApiKeySecret,
  hashApiKey,
  maskApiKey,
  truncateKeyDisplay,
  isApiKeyToken,
  resolveApiKeyExpiryDays,
  computeApiKeyExpiresAt,
  evaluateApiKeyRow,
  checkApiKeyAuth,
  touchApiKeyLastUsed,
  type ApiKeyRow,
  type ApiKeyDb,
} from './apiKeys';

// 対象: 新設予定のAPIキー管理機能(トップページのAPIキーによるログイン判定、
// 🔑キー管理ページでの発行/失効)を支える純粋関数群。
//
// 故障シナリオ:
//   (1) 生成したキーが毎回同じ/推測しやすい(乱数源の使い方の誤り)
//   (2) ハッシュ化のアルゴリズム・エンコーディングが呼び出しごとに変わり、
//       DB照合時に一致しなくなる
//   (3) 有効期限入力(30/90/無期限以外の不正値)がそのまま「無期限」として
//       扱われてしまう
//   (4) revoke済み・期限切れ・アカウント無効化のいずれかの判定漏れにより、
//       本来拒否すべきキーでログイン成功と判定してしまう

describe('generateApiKeySecret', () => {
  it(`${API_KEY_PREFIX}で始まる文字列を返す`, () => {
    const key = generateApiKeySecret();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it('十分な長さのランダム部分を持つ(推測困難)', () => {
    const key = generateApiKeySecret();
    const body = key.slice(API_KEY_PREFIX.length);
    expect(body.length).toBe(64); // 32byte -> hex 64文字
    expect(/^[0-9a-f]+$/.test(body)).toBe(true);
  });

  it('連続生成しても毎回異なる値になる', () => {
    const keys = new Set(Array.from({ length: 20 }, () => generateApiKeySecret()));
    expect(keys.size).toBe(20);
  });
});

describe('hashApiKey', () => {
  it('同じ入力からは常に同じハッシュ値を返す(照合可能性)', async () => {
    const key = 'nkapi_test-fixed-value';
    const h1 = await hashApiKey(key);
    const h2 = await hashApiKey(key);
    expect(h1).toBe(h2);
  });

  it('異なる入力からは異なるハッシュ値を返す', async () => {
    const h1 = await hashApiKey('nkapi_aaa');
    const h2 = await hashApiKey('nkapi_bbb');
    expect(h1).not.toBe(h2);
  });

  it('SHA-256のhex文字列(64文字)を返す', async () => {
    const h = await hashApiKey('nkapi_test');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('maskApiKey', () => {
  it('先頭8文字だけ残し残りをマスクする', () => {
    const raw = API_KEY_PREFIX + 'ab12cd34ef56gh78';
    const masked = maskApiKey(raw);
    expect(masked).toBe(API_KEY_PREFIX + 'ab12cd34' + '*'.repeat(raw.length - API_KEY_PREFIX.length - 8));
  });

  it('マスク後の文字列に生キーの後半部分が含まれない', () => {
    const raw = generateApiKeySecret();
    const masked = maskApiKey(raw);
    const secretTail = raw.slice(-16);
    expect(masked).not.toContain(secretTail);
  });
});

describe('truncateKeyDisplay', () => {
  it('偶数長の文字列は前半ちょうど半分を返す', () => {
    expect(truncateKeyDisplay('abcdefgh')).toBe('abcd');
  });

  it('奇数長の文字列は切り上げで前半に含める(中央の1文字は残す)', () => {
    expect(truncateKeyDisplay('abcde')).toBe('abc');
  });

  it('maskApiKeyの出力(nkapi_プレフィックス+マスク済み文字列)に対しても前半のみ返す', () => {
    const masked = maskApiKey(API_KEY_PREFIX + 'ab12cd34ef56gh78ij90kl12mn34op56');
    const truncated = truncateKeyDisplay(masked);
    expect(truncated.length).toBe(Math.ceil(masked.length / 2));
    expect(masked.startsWith(truncated)).toBe(true);
  });

  it('空文字列を渡しても例外を投げず空文字列を返す', () => {
    expect(truncateKeyDisplay('')).toBe('');
  });
});

describe('isApiKeyToken', () => {
  it(`${API_KEY_PREFIX}で始まるトークンをAPIキーと判定する`, () => {
    expect(isApiKeyToken(generateApiKeySecret())).toBe(true);
  });

  it('セッションJWT形式(ドット区切り3パーツ)はAPIキーと判定しない', () => {
    expect(isApiKeyToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.abcdef')).toBe(false);
  });
});

describe('resolveApiKeyExpiryDays', () => {
  it('30を渡すと30を返す', () => {
    expect(resolveApiKeyExpiryDays(30)).toBe(30);
  });

  it('90を渡すと90を返す', () => {
    expect(resolveApiKeyExpiryDays('90')).toBe(90);
  });

  it('nullを渡すと無期限(null)を返す', () => {
    expect(resolveApiKeyExpiryDays(null)).toBeNull();
  });

  it('不正な値(60等)は無期限にせずデフォルト30日にフォールバックする', () => {
    expect(resolveApiKeyExpiryDays(60)).toBe(30);
    expect(resolveApiKeyExpiryDays('invalid')).toBe(30);
    expect(resolveApiKeyExpiryDays(undefined)).toBe(30);
  });
});

describe('computeApiKeyExpiresAt', () => {
  const now = new Date('2026-08-15T00:00:00.000Z');

  it('30日後のISO文字列を返す', () => {
    const expires = computeApiKeyExpiresAt(30, now);
    expect(expires).toBe('2026-09-14T00:00:00.000Z');
  });

  it('無期限(null)の場合はnullを返す', () => {
    expect(computeApiKeyExpiresAt(null, now)).toBeNull();
  });
});

describe('evaluateApiKeyRow', () => {
  const now = new Date('2026-08-15T00:00:00.000Z');
  const baseRow: ApiKeyRow = {
    id: 'key1',
    user_id: 'user1',
    label: 'test',
    expires_at: null,
    revoked_at: null,
  };

  it('該当行が存在しない場合はnot_foundで無効', () => {
    const result = evaluateApiKeyRow(null, now, false);
    expect(result).toEqual({ valid: false, reason: 'not_found' });
  });

  it('revoked_atが設定されている場合はrevokedで無効', () => {
    const result = evaluateApiKeyRow({ ...baseRow, revoked_at: '2026-08-14T00:00:00.000Z' }, now, false);
    expect(result).toEqual({ valid: false, reason: 'revoked' });
  });

  it('expires_atが現在時刻より過去の場合はexpiredで無効', () => {
    const result = evaluateApiKeyRow({ ...baseRow, expires_at: '2026-08-14T23:59:59.000Z' }, now, false);
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('expires_atが現在時刻ちょうどの場合もexpiredで無効(境界値)', () => {
    const result = evaluateApiKeyRow({ ...baseRow, expires_at: now.toISOString() }, now, false);
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('expires_atが未来の場合は有効', () => {
    const result = evaluateApiKeyRow({ ...baseRow, expires_at: '2026-09-15T00:00:00.000Z' }, now, false);
    expect(result).toEqual({ valid: true, userId: 'user1', keyId: 'key1' });
  });

  it('キー自体は有効でもアカウント側がrevoked済みならaccount_revokedで無効', () => {
    const result = evaluateApiKeyRow(baseRow, now, true);
    expect(result).toEqual({ valid: false, reason: 'account_revoked' });
  });

  it('無期限・未revoke・アカウントも無効化されていない場合は有効', () => {
    const result = evaluateApiKeyRow(baseRow, now, false);
    expect(result).toEqual({ valid: true, userId: 'user1', keyId: 'key1' });
  });
});

// checkApiKeyAuth/touchApiKeyLastUsed 用の最小モックDB。
// api_keys / user_sessions への実際のクエリ文字列は見ず、呼び出し順に
// 決め打ちの行を返すことでモック地獄を避け、戻り値の組み合わせだけを検証する
// (CLAUDE.mdルール15)。
function createMockDb(rows: (Record<string, unknown> | null)[]): { db: ApiKeyDb; calls: string[] } {
  const calls: string[] = [];
  let callIndex = 0;
  const db: ApiKeyDb = {
    prepare(sql: string) {
      calls.push(sql);
      return {
        bind() {
          return {
            async first<T>() {
              const row = rows[callIndex++];
              return (row ?? null) as T | null;
            },
            async run() {
              callIndex++;
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { db, calls };
}

describe('checkApiKeyAuth', () => {
  const now = new Date('2026-08-15T00:00:00.000Z');

  it('該当するapi_keys行が無ければnot_foundで無効(user_sessionsへは問い合わせない)', async () => {
    const { db, calls } = createMockDb([null]);
    const result = await checkApiKeyAuth(db, 'nkapi_missing', now);
    expect(result).toEqual({ valid: false, reason: 'not_found' });
    expect(calls).toHaveLength(1);
  });

  it('api_keys行が有効でuser_sessionsも無効化されていなければvalid', async () => {
    const { db } = createMockDb([
      { id: 'k1', user_id: 'user1', label: 'test', expires_at: null, revoked_at: null },
      { revoked_at: null },
    ]);
    const result = await checkApiKeyAuth(db, 'nkapi_valid', now);
    expect(result).toEqual({ valid: true, userId: 'user1', keyId: 'k1' });
  });

  it('api_keys行は有効でもuser_sessions.revoked_atが設定されていればaccount_revokedで無効', async () => {
    const { db } = createMockDb([
      { id: 'k1', user_id: 'user1', label: 'test', expires_at: null, revoked_at: null },
      { revoked_at: '2026-08-01T00:00:00.000Z' },
    ]);
    const result = await checkApiKeyAuth(db, 'nkapi_valid-but-account-revoked', now);
    expect(result).toEqual({ valid: false, reason: 'account_revoked' });
  });

  it('api_keys行自体がrevoked_at済みならuser_sessionsを見るまでもなくrevokedで無効', async () => {
    const { db } = createMockDb([
      { id: 'k1', user_id: 'user1', label: 'test', expires_at: null, revoked_at: '2026-08-01T00:00:00.000Z' },
    ]);
    const result = await checkApiKeyAuth(db, 'nkapi_revoked', now);
    expect(result).toEqual({ valid: false, reason: 'revoked' });
  });
});

describe('touchApiKeyLastUsed', () => {
  it('UPDATE文を1回発行する', async () => {
    const { db, calls } = createMockDb([]);
    await touchApiKeyLastUsed(db, 'nkapi_test');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('UPDATE api_keys SET last_used_at');
  });
});
