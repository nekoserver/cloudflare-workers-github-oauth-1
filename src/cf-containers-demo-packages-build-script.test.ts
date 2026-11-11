import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// 対象: scripts/build-demo-packages-ubuntu26.sh。containers/demo/packages/ の git と Apache を、別の Ubuntu 26.04 x86_64 で作るためのスクリプト。
// CLAUDE.md コンテナビルドのルール8(このコンテナではソースからビルドしない)・2(上流の公開ハッシュと照合)・4(失敗を隠さない)・5(書き換えの結果を検査)。
// 故障想定: Ubuntu 26.04 以外で作って実行時のライブラリと食い違う / 取得物を照合しない / 失敗しても続ける / 版とハッシュがずれる。
const script = readFileSync(new URL('../scripts/build-demo-packages-ubuntu26.sh', import.meta.url), 'utf8');

describe('demo の git と Apache を Ubuntu 26.04 で作るスクリプト', () => {
  it('bash として構文が正しく、set -eu で失敗を隠さない', () => {
    expect(() => execFileSync('bash', ['-n'], { input: script })).not.toThrow();
    expect(script.startsWith('#!/bin/bash\n')).toBe(true);
    expect(script).toContain('\nset -euo pipefail\n');
    expect(script).not.toMatch(/&&[^\n]*\|\|/);
  });
  it('Ubuntu 26.04 の x86_64 以外では止まる', () => {
    expect(script).toContain('VERSION_ID="26.04"');
    expect(script).toContain('x86_64');
  });
  it('上流が公開するハッシュ(git は kernel.org の sha256sums.asc、Apache は .sha512)で照合する', () => {
    expect(script).toContain('GIT_VERSION=2.56.1');
    expect(script).toContain('f0b0bf89264b9bd2e1c640363e7529643989da76281600473c50745cd34a607f');
    expect(script).toContain('HTTPD_VERSION=2.4.71');
    expect(script).toContain('3dbd1b5f9fda192ae9399612c62ccfc90d329f35b6fda5b6d482f4c28b598b50e479738f8cf64c9b7febcff564811de43f2d84b3a2e24d41c29abdf77a50ef92');
    expect(script).toContain('sha256sum -c -');
    expect(script).toContain('sha512sum -c -');
    expect(script).toContain('archive.apache.org');
  });
  it('Apache の設定の書き換えは直後に grep -q で検査する', () => {
    expect(script).toMatch(/sed -i 's\|\^#define HTTPD_ROOT[^\n]*\n[^\n]*grep -qx '#define HTTPD_ROOT "\/etc\/apache2"'/);
  });
});
