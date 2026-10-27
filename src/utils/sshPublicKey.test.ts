import { describe, it, expect } from 'vitest';
import { validateSshPublicKey, isSameOrigin } from './sshPublicKey';

// 実在の形式に合わせたテスト用の公開鍵(秘密鍵ではない)。
const ED25519 = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl test@example';
const ED25519_NO_COMMENT = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl';

describe('validateSshPublicKey', () => {
  it('ed25519 の公開鍵を受け付け、正規化した値を返す', () => {
    const r = validateSshPublicKey(`  ${ED25519}  `);
    expect(r).toEqual({ ok: true, value: ED25519, keyType: 'ssh-ed25519', body: 'AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl' });
  });

  it('コメントなしの公開鍵も受け付ける', () => {
    const r = validateSshPublicKey(ED25519_NO_COMMENT);
    expect(r.ok).toBe(true);
  });

  it('空は拒否する', () => {
    expect(validateSshPublicKey('   ')).toMatchObject({ ok: false, errorCode: 'EMPTY' });
  });

  it('秘密鍵の貼り付けを拒否する', () => {
    const r = validateSshPublicKey('-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----');
    expect(r).toMatchObject({ ok: false, errorCode: 'PRIVATE_KEY' });
  });

  it('複数行を拒否する(1行に1鍵だけ受け付ける)', () => {
    const r = validateSshPublicKey(`${ED25519}\n${ED25519_NO_COMMENT}`);
    expect(r).toMatchObject({ ok: false, errorCode: 'MULTILINE' });
  });

  it('未対応の鍵種別を拒否する', () => {
    const r = validateSshPublicKey('ssh-dss AAAAB3NzaC1kc3MAAACBAP test');
    expect(r).toMatchObject({ ok: false, errorCode: 'UNSUPPORTED_TYPE' });
  });

  it('base64として壊れた本体を拒否する', () => {
    const r = validateSshPublicKey('ssh-ed25519 !!!notbase64!!! test');
    expect(r).toMatchObject({ ok: false, errorCode: 'INVALID_BODY' });
  });

  it('鍵種別と本体の中身が一致しなければ拒否する', () => {
    // 本体は ed25519 の鍵だが、種別を ssh-rsa と書いている
    const r = validateSshPublicKey(ED25519.replace('ssh-ed25519', 'ssh-rsa'));
    expect(r).toMatchObject({ ok: false, errorCode: 'TYPE_MISMATCH' });
  });
});

describe('isSameOrigin', () => {
  it('Origin が要求のオリジンと一致すれば true', () => {
    expect(isSameOrigin('https://w.example.workers.dev', 'https://w.example.workers.dev/api/x')).toBe(true);
  });

  it('Origin が無ければ false(同一Origin を確認できない)', () => {
    expect(isSameOrigin(undefined, 'https://w.example.workers.dev/api/x')).toBe(false);
  });

  it('別オリジンなら false', () => {
    expect(isSameOrigin('https://evil.example.com', 'https://w.example.workers.dev/api/x')).toBe(false);
  });

  it('ポートが違えば別オリジンとして false', () => {
    expect(isSameOrigin('https://w.example.workers.dev:8443', 'https://w.example.workers.dev/api/x')).toBe(false);
  });
});
