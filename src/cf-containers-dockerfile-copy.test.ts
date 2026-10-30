import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { posix } from 'node:path';

// イメージへコピーするスクリプトが `require('./x')` で読み込むファイルは、同じ場所へコピーされていなければ、
// コンテナの起動時に落ちる(2026-10-30、t3-stale-session.cjsのCOPYを入れ忘れかけた)。Dockerfileとソースの対応を検査する。
const DEMO = new URL('../containers/demo/', import.meta.url);
const SCRIPT = /\.(cjs|mjs|js)$/;

type Copy = { dir: string; name: string; source: string };

export function parseCopies(dockerfile: string): Copy[] {
  const copies: Copy[] = [];
  for (const line of dockerfile.split('\n')) {
    const match = line.match(/^COPY\s+(.+)$/);
    if (!match || match[1].startsWith('--from')) continue;
    const parts = match[1].trim().split(/\s+/);
    const destination = parts.pop()!;
    for (const source of parts) {
      if (/[*?]/.test(source)) continue;
      const base = posix.basename(source);
      if (destination.endsWith('/')) copies.push({ dir: destination.replace(/\/$/, ''), name: base, source });
      else copies.push({ dir: posix.dirname(destination), name: posix.basename(destination), source });
    }
  }
  return copies;
}

export function missingRequires(dockerfile: string, readSource: (path: string) => string | null): string[] {
  const copies = parseCopies(dockerfile);
  const missing: string[] = [];
  for (const copy of copies) {
    if (!SCRIPT.test(copy.source)) continue;
    const text = readSource(copy.source);
    if (text === null) { missing.push(`${copy.source}: コピー元のファイルが無い`); continue; }
    for (const found of text.matchAll(/require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)) {
      const required = posix.basename(found[1]);
      if (!copies.some(other => other.dir === copy.dir && other.name === required)) missing.push(`${copy.source} が読み込む ${required} が、${copy.dir} へコピーされていない`);
    }
  }
  return missing;
}

const read = (path: string) => { const url = new URL(path, DEMO); return existsSync(url) ? readFileSync(url, 'utf8') : null; };

describe('Dockerfileのコピーと、スクリプトのrequireの対応', () => {
  const dockerfile = readFileSync(new URL('Dockerfile', DEMO), 'utf8');

  it('実際のDockerfileは、コピーするスクリプトが読み込むファイルをすべてコピーしている', () => {
    expect(missingRequires(dockerfile, read)).toEqual([]);
  });

  it('T3の中継が読み込む2つのファイルを、実際に検査の対象にしている(空の検査で通らない)', () => {
    const copies = parseCopies(dockerfile);
    for (const name of ['t3-embed-proxy.cjs', 't3-pwa-auth.cjs', 't3-stale-session.cjs']) {
      expect(copies.some(copy => copy.name === name && copy.dir === '/usr/local/libexec')).toBe(true);
    }
    expect(read('t3-embed-proxy.cjs')).toContain("require('./t3-stale-session.cjs')");
  });

  it('COPYを入れ忘れた場合は、失敗として検出する', () => {
    const broken = dockerfile.replace(' t3-stale-session.cjs', '');
    expect(broken).not.toBe(dockerfile);
    const missing = missingRequires(broken, read);
    expect(missing.length).toBe(1);
    expect(missing[0]).toContain('t3-stale-session.cjs');
  });

  it('別の場所へコピーした場合も、検出する', () => {
    const moved = dockerfile.replace('COPY t3-pwa-auth.cjs t3-stale-session.cjs t3-pwa-client.js t3-pwa-client.css /usr/local/libexec/', 'COPY t3-pwa-auth.cjs t3-pwa-client.js t3-pwa-client.css /usr/local/libexec/\nCOPY t3-stale-session.cjs /opt/other/');
    expect(missingRequires(moved, read).length).toBe(1);
  });

  it('コピー元のファイルが無い場合も、検出する', () => {
    expect(missingRequires('COPY no-such-file.cjs /usr/local/libexec/', read)).toEqual(['no-such-file.cjs: コピー元のファイルが無い']);
  });
});
