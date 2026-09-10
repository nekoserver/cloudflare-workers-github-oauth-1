/**
 * dynamicnekoAichatPermission.ts のテスト
 *
 * 対象: dynamicnekoのAI問い合わせウィジェットの利用可否を、D1
 * dynamicneko_aichat_allowed_usersテーブルへの登録メールアドレスで判定する
 * isDynamicnekoAichatAllowed / normalizeAllowlistEmail。
 *
 * 故障シナリオ:
 *   (1) メールアドレスの大文字小文字・前後空白の違いで別人扱いされ、
 *       登録済みユーザーが弾かれてしまう
 *   (2) 空文字・未定義のメールアドレスがDBクエリまで到達し、
 *       全件一致(WHERE句なし相当)のような事故につながる
 *   (3) 未登録メールアドレスが誤ってtrueと判定される
 */
import { describe, it, expect, vi } from 'vitest';
import {
  isDynamicnekoAichatAllowed,
  normalizeAllowlistEmail,
  resolveDynamicnekoAichatModel,
  DYNAMICNEKO_AICHAT_DEFAULT_MODEL,
} from './dynamicnekoAichatPermission';

function createMockDb(matchingEmail: string | null) {
  const first = vi.fn().mockImplementation(() => {
    return Promise.resolve(matchingEmail ? { 1: 1 } : null);
  });
  const bind = vi.fn().mockReturnValue({ first });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { prepare, bind, first } as unknown as D1Database & { bind: typeof bind; first: typeof first };
}

describe('normalizeAllowlistEmail', () => {
  it('前後空白を除去し小文字化する', () => {
    expect(normalizeAllowlistEmail('  Foo@Example.com ')).toBe('foo@example.com');
  });
});

describe('isDynamicnekoAichatAllowed', () => {
  it('登録済みメールアドレス(大文字小文字違い)でもtrueを返す', async () => {
    const db = createMockDb('foo@example.com');
    const allowed = await isDynamicnekoAichatAllowed(db, 'FOO@example.com');
    expect(allowed).toBe(true);
    expect(db.bind).toHaveBeenCalledWith('foo@example.com');
  });

  it('未登録メールアドレスはfalseを返す', async () => {
    const db = createMockDb(null);
    const allowed = await isDynamicnekoAichatAllowed(db, 'notallowed@example.com');
    expect(allowed).toBe(false);
  });

  it('空文字・空白のみのメールアドレスはDBへ問い合わせずfalseを返す', async () => {
    const db = createMockDb('foo@example.com');
    const allowed = await isDynamicnekoAichatAllowed(db, '   ');
    expect(allowed).toBe(false);
    expect(db.bind).not.toHaveBeenCalled();
  });
});

describe('resolveDynamicnekoAichatModel', () => {
  it('未指定(undefined/null/空文字)はデフォルト(Gemma-4)を返す', () => {
    expect(resolveDynamicnekoAichatModel(undefined)).toBe(DYNAMICNEKO_AICHAT_DEFAULT_MODEL);
    expect(resolveDynamicnekoAichatModel(null)).toBe(DYNAMICNEKO_AICHAT_DEFAULT_MODEL);
    expect(resolveDynamicnekoAichatModel('')).toBe(DYNAMICNEKO_AICHAT_DEFAULT_MODEL);
    expect(resolveDynamicnekoAichatModel('   ')).toBe(DYNAMICNEKO_AICHAT_DEFAULT_MODEL);
  });

  it('許可リストにあるQwen3.8を指定した場合はそのまま返す', () => {
    expect(resolveDynamicnekoAichatModel('@cf/qwen/qwen3.8-27b')).toBe('@cf/qwen/qwen3.8-27b');
  });

  it('許可リストに無いモデルID(改ざん・タイポ)はデフォルトへフォールバックする', () => {
    expect(resolveDynamicnekoAichatModel('@cf/meta/llama-3.3-70b-instruct-fp8-fast')).toBe(DYNAMICNEKO_AICHAT_DEFAULT_MODEL);
    expect(resolveDynamicnekoAichatModel('not-a-real-model')).toBe(DYNAMICNEKO_AICHAT_DEFAULT_MODEL);
  });
});
