import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildExtraAuthorizedKeys } from './utils/sshPublicKey';
import { WRITABLE_SECRET_NAMES, ALLOWED_SECRET_NAMES } from './utils/cfWorkerSecretApi';

// /cf-containers の画面から公開鍵を登録し、コンテナの authorized_keys に反映するまでの配線を確認する。
const ED25519 = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl test@example';
const ED25519_B = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl other@example';

describe('buildExtraAuthorizedKeys', () => {
  it('登録済みの鍵を1行ずつ改行でつなぐ', () => {
    expect(buildExtraAuthorizedKeys([ED25519])).toBe(ED25519 + '\n');
  });

  it('鍵が無ければ空文字を返す(authorized_keysへは何も足さない)', () => {
    expect(buildExtraAuthorizedKeys([])).toBe('');
  });
});

describe('Secret の書き込み範囲', () => {
  it('SSH_EXTRA_AUTHORIZED_KEYS は書き込み可能だが、汎用の Secret API には出ない', () => {
    expect(WRITABLE_SECRET_NAMES).toContain('SSH_EXTRA_AUTHORIZED_KEYS');
    expect(ALLOWED_SECRET_NAMES as readonly string[]).not.toContain('SSH_EXTRA_AUTHORIZED_KEYS');
  });
});

describe('登録の配線', () => {
  it('コンテナが SSH_EXTRA_AUTHORIZED_KEYS を環境変数として受け取る', () => {
    const c = readFileSync('src/containers/demoContainer.ts', 'utf-8');
    expect(c).toMatch(/SSH_EXTRA_AUTHORIZED_KEYS: env\.SSH_EXTRA_AUTHORIZED_KEYS \?\? ''/);
    expect(c).toMatch(/WRITABLE_SECRET_NAMES/);
  });

  it('entrypoint.sh が登録済みの鍵を authorized_keys へ追加する', () => {
    const e = readFileSync('containers/demo/entrypoint.sh', 'utf-8');
    expect(e).toMatch(/SSH_EXTRA_AUTHORIZED_KEYS/);
    expect(e).toMatch(/>> \/root\/\.ssh\/authorized_keys/);
  });

  it('管理APIは管理者認証と同一Originを要求する', () => {
    const s = readFileSync('src/index.ts', 'utf-8');
    expect(s).toMatch(/app\.post\('\/api\/cf-containers\/ssh-keys', authMiddleware, cfDashboardAdminMiddleware/);
    expect(s).toMatch(/isSameOrigin\(c\.req\.header\('Origin'\), c\.req\.url\)/);
  });

  it('管理画面に公開鍵の入力欄と登録ボタンがある', () => {
    const v = readFileSync('src/views/cfContainers.ts', 'utf-8');
    expect(v).toMatch(/id="ssh-key-input"/);
    expect(v).toMatch(/id="btn-register-ssh-key"/);
    expect(v).toMatch(/\/api\/cf-containers\/ssh-keys/);
  });

  it('D1テーブルのマイグレーションがある', () => {
    const m = readFileSync('migrations/0188_create_container_ssh_public_keys.sql', 'utf-8');
    expect(m).toMatch(/CREATE TABLE IF NOT EXISTS container_ssh_public_keys/);
    expect(m).not.toMatch(/--/);
  });
});
