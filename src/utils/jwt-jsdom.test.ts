// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createJWT, verifyJWT } from './jwt';

// 対象: jsdom 環境での JWT 検証。
// vitest の jsdom 環境では ArrayBuffer の realm が Node の SubtleCrypto と
// 食い違い、verify の第3引数に raw ArrayBuffer を渡すと
// "3rd argument is not instance of ArrayBuffer" で失敗する。
// GET /cheese-search や GET /wasm-modules など jsdom + app.request の認証テストが
// 毎回 401 になる原因だった。
//
// 故障シナリオ:
//   (1) jsdom で createJWT したトークンを verifyJWT すると null になる
//   (2) 改ざんトークンが jsdom でも通ってしまう
describe('jsdom環境のJWT検証', () => {
  it('createJWTで作ったトークンをverifyJWTで復元できる', async () => {
    const token = await createJWT({ sub: 'jsdom-user', name: 'Jsdom' }, 'test-secret');
    const payload = await verifyJWT(token, 'test-secret');
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('jsdom-user');
    expect(payload?.name).toBe('Jsdom');
  });

  it('改ざんしたトークンはnullを返す', async () => {
    const token = await createJWT({ sub: 'jsdom-user' }, 'test-secret');
    const tampered = token.slice(0, -2) + 'ab';
    const payload = await verifyJWT(tampered, 'test-secret');
    expect(payload).toBeNull();
  });
});
