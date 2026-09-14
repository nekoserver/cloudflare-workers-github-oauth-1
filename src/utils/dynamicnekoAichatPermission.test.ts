/**
 * dynamicnekoAichatPermission.ts のテスト
 *
 * 対象: dynamicnekoのAI問い合わせウィジェットの利用可否を、D1
 * dynamicneko_aichat_allowed_usersテーブルへの登録メールアドレスで判定する
 * isDynamicnekoAichatAllowed / normalizeAllowlistEmail、および
 * リクエスト本文のloginをそのまま信用しないための resolveDynamicnekoAllowedLogin。
 *
 * 故障シナリオ:
 *   (1) メールアドレスの大文字小文字・前後空白の違いで別人扱いされ、
 *       登録済みユーザーが弾かれてしまう
 *   (2) 空文字・未定義のメールアドレスがDBクエリまで到達し、
 *       全件一致(WHERE句なし相当)のような事故につながる
 *   (3) 未登録メールアドレスが誤ってtrueと判定される
 *   (4)(セキュリティ) 許可済みメール1件を知っていれば、リクエスト本文の
 *       loginを任意の値に差し替えるだけで他ユーザーのuser_idとして検索・
 *       書き込みできてしまう(PR #1809/#1810で発覚した脆弱性)。
 *       resolveDynamicnekoAllowedLoginはクライアント入力のloginを一切
 *       受け取らず、常にDB側でemailに紐づく登録済みloginだけを返すことで
 *       これを防ぐ
 *   (5) github_login未登録(NULL/空文字)の行を、うっかり空文字のuser_idとして
 *       扱ってしまう(空文字だと全ユーザー分の履歴に一致しうる列がある可能性を
 *       排除できないため、必ずnullを返し呼び出し元でエラー扱いさせる)
 */
import { describe, it, expect, vi } from 'vitest';
import {
  isDynamicnekoAichatAllowed,
  normalizeAllowlistEmail,
  resolveDynamicnekoAichatModel,
  resolveDynamicnekoAllowedLogin,
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

function createMockDbWithLogin(row: { email: string; github_login: string | null } | null) {
  const first = vi.fn().mockImplementation(() => {
    return Promise.resolve(row ? { github_login: row.github_login } : null);
  });
  const bind = vi.fn().mockReturnValue({ first });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { prepare, bind, first } as unknown as D1Database & { bind: typeof bind; first: typeof first };
}

describe('resolveDynamicnekoAllowedLogin', () => {
  it('登録済みメールアドレスに紐づくgithub_loginを返す(クライアント入力のloginは一切受け取らない引数設計)', async () => {
    const db = createMockDbWithLogin({ email: 'foo@example.com', github_login: 'foo-github' });
    const login = await resolveDynamicnekoAllowedLogin(db, 'FOO@example.com');
    expect(login).toBe('foo-github');
    expect(db.bind).toHaveBeenCalledWith('foo@example.com');
  });

  it('未登録メールアドレスはnullを返す', async () => {
    const db = createMockDbWithLogin(null);
    const login = await resolveDynamicnekoAllowedLogin(db, 'notallowed@example.com');
    expect(login).toBeNull();
  });

  it('登録済みだがgithub_login未設定(NULL)の行はnullを返す(空文字user_idとして扱わない)', async () => {
    const db = createMockDbWithLogin({ email: 'foo@example.com', github_login: null });
    const login = await resolveDynamicnekoAllowedLogin(db, 'foo@example.com');
    expect(login).toBeNull();
  });

  it('登録済みだがgithub_loginが空白のみの行はnullを返す', async () => {
    const db = createMockDbWithLogin({ email: 'foo@example.com', github_login: '   ' });
    const login = await resolveDynamicnekoAllowedLogin(db, 'foo@example.com');
    expect(login).toBeNull();
  });

  it('空文字・空白のみのメールアドレスはDBへ問い合わせずnullを返す', async () => {
    const db = createMockDbWithLogin({ email: 'foo@example.com', github_login: 'foo-github' });
    const login = await resolveDynamicnekoAllowedLogin(db, '   ');
    expect(login).toBeNull();
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
