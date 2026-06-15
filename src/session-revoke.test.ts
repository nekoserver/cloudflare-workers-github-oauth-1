import { describe, it, expect } from 'vitest';

// ── buildRevokeResponse のロジックテスト ──────────────────────────────────────
// authMiddleware からロジックを抽出した checkRevoked を対象にテストする

import { checkRevoked } from './middleware/auth';

describe('セッション強制revoke', () => {
  it('revoked_at が設定されている場合は revoked:true を返す', () => {
    const result = checkRevoked({ revoked_at: '2026-06-15T10:00:00.000Z', last_activity_at: null });
    expect(result).toBe(true);
  });

  it('revoked_at が null の場合は revoked:false を返す', () => {
    const result = checkRevoked({ revoked_at: null, last_activity_at: null });
    expect(result).toBe(false);
  });

  it('revoked_at が undefined の場合は revoked:false を返す', () => {
    const result = checkRevoked({ revoked_at: undefined as unknown as null, last_activity_at: null });
    expect(result).toBe(false);
  });
});

// ── POST /api/admin/revoke-session の入力バリデーション ──────────────────────
import { validateRevokeRequest } from './utils/revoke';

describe('revokeRequest バリデーション', () => {
  it('userId が空文字の場合はエラーを返す', () => {
    expect(validateRevokeRequest({ userId: '' })).toEqual({ ok: false, error: 'userId は必須です' });
  });

  it('userId が null の場合はエラーを返す', () => {
    expect(validateRevokeRequest({ userId: null as unknown as string })).toEqual({ ok: false, error: 'userId は必須です' });
  });

  it('userId が文字列の場合は ok:true を返す', () => {
    expect(validateRevokeRequest({ userId: 'nekoserver' })).toEqual({ ok: true });
  });

  it('reason は省略可能', () => {
    expect(validateRevokeRequest({ userId: 'nekoserver', reason: undefined })).toEqual({ ok: true });
  });

  it('reason が文字列の場合も ok:true を返す', () => {
    expect(validateRevokeRequest({ userId: 'nekoserver', reason: '不審なアクセス' })).toEqual({ ok: true });
  });
});
