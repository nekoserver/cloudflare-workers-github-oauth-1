import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { WRITABLE_SECRET_NAMES, ALLOWED_SECRET_NAMES } from './utils/cfWorkerSecretApi';

// 公開鍵は1つだけ Worker Secret SSH_EXTRA_AUTHORIZED_KEYS に保存し、登録のたびに置き換える。
// データベースは使わない。
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
  });

  it('entrypoint.sh が鍵を authorized_keys へ追記する', () => {
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

  it('D1 を使わない(マイグレーションもテーブル参照も無い)', () => {
    const s = readFileSync('src/index.ts', 'utf-8');
    const start = s.indexOf("app.post('/api/cf-containers/ssh-keys'");
    const block = s.slice(start, s.indexOf('/** デモコンテナの起動', start));
    expect(block).not.toMatch(/container_ssh_public_keys/);
    expect(block).not.toMatch(/prepare\(/);
  });
});
