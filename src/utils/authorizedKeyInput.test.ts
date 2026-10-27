import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validatePublicKeyLine, hmacInputMatches, hmacInputMatchesAny, resolveOriginHmacSecrets } from './authorizedKeyInput';

const KEY = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC2kQ2c3dcds19h599IEkj45GWerMrzC0AELnKqaOMZc';

describe('validatePublicKeyLine', () => {
  it('1行の公開鍵を受け付ける(前後の空白は除く)', () => {
    expect(validatePublicKeyLine(`  ${KEY} user@host \n`)).toEqual({ ok: true, value: `${KEY} user@host` });
  });

  it('空・秘密鍵・複数行・未対応の種別・壊れた本体を拒否する', () => {
    expect(validatePublicKeyLine(' ')).toMatchObject({ ok: false, errorCode: 'EMPTY' });
    expect(validatePublicKeyLine('-----BEGIN OPENSSH PRIVATE KEY-----')).toMatchObject({ ok: false, errorCode: 'PRIVATE_KEY' });
    expect(validatePublicKeyLine(`${KEY}\n${KEY}`)).toMatchObject({ ok: false, errorCode: 'MULTILINE' });
    expect(validatePublicKeyLine('ssh-dss AAAAB3NzaC1kc3M')).toMatchObject({ ok: false, errorCode: 'UNSUPPORTED_TYPE' });
    expect(validatePublicKeyLine('ssh-ed25519 !!!')).toMatchObject({ ok: false, errorCode: 'INVALID_BODY' });
  });
});

describe('hmacInputMatches', () => {
  it('一致すれば true', () => {
    expect(hmacInputMatches('secret-value', 'secret-value')).toBe(true);
  });

  it('不一致・長さ違い・空は false', () => {
    expect(hmacInputMatches('secret-valuX', 'secret-value')).toBe(false);
    expect(hmacInputMatches('secret', 'secret-value')).toBe(false);
    expect(hmacInputMatches('', 'secret-value')).toBe(false);
  });

  it('サーバー側のシークレットが未設定なら、入力が空でも一致としない', () => {
    expect(hmacInputMatches('', '')).toBe(false);
    expect(hmacInputMatches('x', undefined)).toBe(false);
  });
});

describe('貼り付けの空白', () => {
  it('入力の前後の空白・改行は無視して一致とする', () => {
    expect(hmacInputMatches('  secret-value\n', 'secret-value')).toBe(true);
    expect(hmacInputMatches('secret-value', ' secret-value \n')).toBe(true);
  });
});

describe('resolveOriginHmacSecrets / hmacInputMatchesAny', () => {
  it('設定されているシークレットをすべて候補にする', () => {
    expect(resolveOriginHmacSecrets({ ORIGIN_HMAC_SECRET: 'a', HMAC_SECRET: 'b', REDMINE_HMAC_SECRET: ' ' })).toEqual(['a', 'b']);
    expect(resolveOriginHmacSecrets({})).toEqual([]);
  });

  it('ORIGIN_HMAC_SECRET と HMAC_SECRET が別の値でも、どちらかと一致すれば通す', () => {
    const secrets = resolveOriginHmacSecrets({ ORIGIN_HMAC_SECRET: 'origin-secret', HMAC_SECRET: 'hmac-secret' });
    expect(hmacInputMatchesAny('hmac-secret', secrets)).toBe(true);
    expect(hmacInputMatchesAny('origin-secret', secrets)).toBe(true);
    expect(hmacInputMatchesAny('other', secrets)).toBe(false);
    expect(hmacInputMatchesAny('x', [])).toBe(false);
  });
});

describe('配線', () => {
  it('Worker の API は HMAC 照合の後にだけコンテナへ転送する', () => {
    const s = readFileSync('src/index.ts', 'utf-8');
    const start = s.indexOf("app.post('/api/cf-containers/authorized-keys', authMiddleware, cfDashboardAdminMiddleware");
    expect(start).toBeGreaterThan(-1);
    const block = s.slice(start, s.indexOf('\n});\n', start));
    expect(block.indexOf('hmacInputMatchesAny(')).toBeGreaterThan(-1);
    expect(block.indexOf('hmacInputMatchesAny(')).toBeLessThan(block.indexOf('/admin/authorized-keys'));
  });

  it('汎用プロキシは /admin/ を転送しない(HMAC 照合を迂回させない)', () => {
    const s = readFileSync('src/index.ts', 'utf-8');
    const start = s.indexOf("app.all('/cf-containers/proxy/*'");
    const block = s.slice(start, start + 1200);
    expect(block).toMatch(/forwardPath\.startsWith\('\/admin\/'\)/);
  });

  it('Apache(トンネル経由の公開口)は /admin を拒否する', () => {
    const a = readFileSync('containers/demo/apache-demo.conf', 'utf-8');
    expect(a).toMatch(/LocationMatch "\^\/\(\?:debug\|admin\)\(\?:\/\|\$\)"/);
  });

  it('server.js が /root/.ssh/authorized_keys に追記する', () => {
    const j = readFileSync('containers/demo/server.js', 'utf-8');
    expect(j).toMatch(/\/admin\/authorized-keys/);
    expect(j).toMatch(/appendFileSync\(AUTHORIZED_KEYS_PATH/);
    expect(j).toMatch(/const AUTHORIZED_KEYS_PATH = '\/root\/\.ssh\/authorized_keys'/);
  });

  it('画面に公開鍵と HMAC の入力欄がある', () => {
    const v = readFileSync('src/views/cfContainers.ts', 'utf-8');
    expect(v).toMatch(/id="authorized-key-input"/);
    expect(v).toMatch(/id="authorized-key-hmac" type="password"/);
    expect(v).toMatch(/\/api\/cf-containers\/authorized-keys/);
  });
});
