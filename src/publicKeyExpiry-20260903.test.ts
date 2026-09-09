import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

// 対象: 公開鍵登録(/public-keys)に有効期限(30日/90日/1年/2年/5年/無期限)を
// 追加する機能。src/utils/publicKeyAuth.tsの純粋関数(resolvePublicKeyExpiryDays等)
// は publicKeyAuth-20260903.test.ts で検証済み。ここではそれをDBクエリ・
// 画面配線が正しく使っているかをソースレベルで検証する。
//
// 故障シナリオ:
//   (1) チャレンジ発行(/auth/public-key/challenge, /api/public-keys/challenge)・
//       検証(/auth/public-key/verify, /api/public-keys/verify)のいずれかで
//       expires_atのチェックを入れ忘れ、期限切れの公開鍵でもログイン・照合が
//       通ってしまう(revoked_atだけをチェックしていた旧実装への後退)
//   (2) 登録時にexpiresInDaysを受け取っていても、INSERT文にexpires_atを
//       渡し忘れて常に無期限になる

const indexSrc = fs.readFileSync(path.join(__dirname, 'index.ts'), 'utf-8');
const publicKeysViewSrc = fs.readFileSync(path.join(__dirname, 'views', 'publicKeys.ts'), 'utf-8');

describe('公開鍵の有効性チェックがrevoked_atだけでなくexpires_atも見る(4箇所)', () => {
  const expectedFragment = "revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)";

  it('/auth/public-key/challenge', () => {
    const start = indexSrc.indexOf("app.post('/auth/public-key/challenge'");
    const body = indexSrc.slice(start, start + 2000);
    expect(body).toContain(expectedFragment);
  });

  it('/auth/public-key/verify', () => {
    const start = indexSrc.indexOf("app.post('/auth/public-key/verify'");
    const body = indexSrc.slice(start, start + 3000);
    expect(body).toContain(expectedFragment);
  });

  it('/api/public-keys/challenge', () => {
    const start = indexSrc.indexOf("app.post('/api/public-keys/challenge'");
    const body = indexSrc.slice(start, start + 2000);
    expect(body).toContain(expectedFragment);
  });

  it('/api/public-keys/verify', () => {
    const start = indexSrc.indexOf("app.post('/api/public-keys/verify'");
    const body = indexSrc.slice(start, start + 3000);
    expect(body).toContain(expectedFragment);
  });
});

describe('POST /api/public-keys: 登録時にexpiresInDaysを受け取りexpires_atを保存する', () => {
  it('resolvePublicKeyExpiryDays/computePublicKeyExpiresAtを使ってINSERTにexpires_atを渡す', () => {
    const start = indexSrc.indexOf("app.post('/api/public-keys',");
    const body = indexSrc.slice(start, start + 1500);
    expect(body).toContain('resolvePublicKeyExpiryDays(body.expiresInDays ?? null)');
    expect(body).toContain('computePublicKeyExpiresAt(expiryDays, now)');
    expect(body).toContain('INSERT INTO user_public_keys (id, user_id, label, public_key_jwk, created_at, expires_at)');
  });
});

describe('GET /api/public-keys: 一覧にexpires_atを含める', () => {
  it('SELECT文にexpires_atが含まれる', () => {
    const idx = indexSrc.indexOf("app.get('/api/public-keys',");
    const body = indexSrc.slice(idx, idx + 700);
    expect(body).toContain('expires_at');
  });
});

describe('/public-keysページ: 有効期限の選択肢と期限切れ表示', () => {
  it('30日/90日/1年/2年/5年/無期限の選択肢がある', () => {
    expect(publicKeysViewSrc).toContain('<option value="30">30日</option>');
    expect(publicKeysViewSrc).toContain('<option value="90">90日</option>');
    expect(publicKeysViewSrc).toContain('<option value="365">1年</option>');
    expect(publicKeysViewSrc).toContain('<option value="730">2年</option>');
    expect(publicKeysViewSrc).toContain('<option value="1825">5年</option>');
    expect(publicKeysViewSrc).toContain('<option value="null" selected>無期限</option>');
  });

  it('登録リクエストにexpiresInDaysを含める', () => {
    expect(publicKeysViewSrc).toContain('expiresInDays: expiresInDays');
  });

  it('期限切れの鍵はstatus-expiredバッジになり、照合テストボタンも無効化される', () => {
    expect(publicKeysViewSrc).toContain('function isKeyExpired(item)');
    expect(publicKeysViewSrc).toContain('status-expired');
    const start = publicKeysViewSrc.indexOf('function renderKeyTable(keys)');
    const body = publicKeysViewSrc.slice(start, start + 900);
    expect(body).toContain('isKeyExpired(item)');
  });
});
