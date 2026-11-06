import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ALLOWED_SECRET_NAMES } from './utils/cfWorkerSecretApi';

const df = readFileSync('containers/demo/Dockerfile', 'utf8');
const entrypoint = readFileSync('containers/demo/entrypoint.sh', 'utf8');
const hardening = readFileSync('containers/demo/sshd-hardening.conf', 'utf8');

describe('demoコンテナのsshの鍵と初期設定', () => {
  it('ビルド時に作られたホスト秘密鍵をイメージに残さない', () => {
    expect(df).toContain('RUN rm -f /etc/ssh/ssh_host_*');
    expect(df.indexOf('RUN rm -f /etc/ssh/ssh_host_*')).toBeGreaterThan(df.indexOf('openssh-server'));
  });
  it('公開鍵だけでログインする', () => {
    expect(df).toContain('COPY sshd-hardening.conf /etc/ssh/sshd_config.d/10-hardening.conf');
    expect(hardening).toMatch(/^AuthenticationMethods publickey$/m);
    expect(hardening).toMatch(/^PasswordAuthentication no$/m);
    expect(hardening).toMatch(/^KbdInteractiveAuthentication no$/m);
    expect(hardening).toMatch(/^PermitRootLogin prohibit-password$/m);
  });
  it('トンネル経由の127.0.0.1を罰しない', () => {
    expect(hardening).toMatch(/^PerSourcePenaltyExemptList 127\.0\.0\.1\/32,::1\/128$/m);
  });
  it('ホスト鍵を引き継ぎ、秘密鍵を子プロセスへ渡さない', () => {
    expect(entrypoint.indexOf('unset SSH_HOST_ED25519_KEY_B64')).toBeLessThan(entrypoint.indexOf('ssh-keygen -A'));
    expect(entrypoint).toContain('rm -f "$host_key" "$host_key.pub"');
  });
  it('OpenSSHの更新時に読むNOTICEへ案内する', () => {
    expect(readFileSync('NOTICE.openssh-update.20261106.md', 'utf8')).toContain('OpenSSH・sshdを更新するときの注意');
    expect(readFileSync('CLAUDE.md', 'utf8')).toContain('NOTICE.openssh-update.20261106.md');
    expect(df).toContain('NOTICE.openssh-update.20261106.md');
  });
  it('secret設定で鍵を変更できる', () => {
    expect(ALLOWED_SECRET_NAMES).toContain('SSH_HOST_ED25519_KEY_B64');
    expect(ALLOWED_SECRET_NAMES).toContain('SSH_AUTHORIZED_KEYS');
    const container = readFileSync('src/containers/demoContainer.ts', 'utf8');
    expect(container).toContain("SSH_HOST_ED25519_KEY_B64: env.SSH_HOST_ED25519_KEY_B64 ?? ''");
  });
});
