import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 本体コンテナは起動のたびに ssh-keygen -A でホスト鍵を作る(イメージに鍵が無いため、作り直すと鍵が変わる)。
// tree-viewのターミナルが鍵を厳密に照合できるよう、公開鍵の登録の応答でホスト鍵(公開鍵)を返す。
const require = createRequire(import.meta.url);
const { readHostKeys } = require('../containers/demo/server.js');

describe('本体コンテナのSSHのホスト鍵', () => {
  it('ssh_host_*_key.pub の公開鍵を、種類とbase64だけにして返す(コメントは落とす)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hostkeys-'));
    writeFileSync(join(dir, 'ssh_host_ed25519_key.pub'), 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHostKey root@abc\n');
    writeFileSync(join(dir, 'ssh_host_rsa_key.pub'), 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQHostKey root@abc\n');
    writeFileSync(join(dir, 'ssh_host_ed25519_key'), '-----BEGIN OPENSSH PRIVATE KEY-----\nsecret\n');
    writeFileSync(join(dir, 'other.pub'), 'ssh-ed25519 AAAAOther x\n');
    expect(readHostKeys(dir).sort()).toEqual(['ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHostKey', 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQHostKey']);
  });
  it('秘密鍵や形の崩れた行は返さない。ディレクトリが無ければ空', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hostkeys-'));
    writeFileSync(join(dir, 'ssh_host_ecdsa_key.pub'), '-----BEGIN OPENSSH PRIVATE KEY-----\n');
    expect(readHostKeys(dir)).toEqual([]);
    expect(readHostKeys(join(dir, 'missing'))).toEqual([]);
  });
});
