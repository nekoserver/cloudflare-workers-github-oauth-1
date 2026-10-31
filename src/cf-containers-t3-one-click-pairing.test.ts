import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getCfContainersPage } from './views/cfContainers';

const require = createRequire(import.meta.url);
const { issueT3Pairing, T3_PAIRING_ARGS } = require('../containers/demo/server.js');

// 契約(T3 0.1.3): `t3 auth pairing create --json --base-url <URL>` は
// {id, credential, scopes, expiresAt, pairUrl} を出力する(formatIssuedPairingCredential)。
// pairUrl は <base>/pair#token=<credential>。1回限り・既定5分。
const T3_OUTPUT = JSON.stringify({ id: 'p1', credential: 'ABCDEF123456', label: 'one-click', scopes: ['orchestration:read'], expiresAt: '2026-10-31T10:05:00.000Z', pairUrl: 'https://t3.nekomaneki.work/pair#token=ABCDEF123456' });

describe('issueT3Pairing', () => {
  it('T3のCLIに、ペアリングの作成をJSONと公開URL付きで頼む', async () => {
    let seen: string[] = [];
    await issueT3Pairing(async (args: string[]) => { seen = args; return T3_OUTPUT; });
    expect(seen).toEqual(T3_PAIRING_ARGS);
    expect(seen.slice(0, 3)).toEqual(['auth', 'pairing', 'create']);
    expect(seen).toContain('--json');
    expect(seen[seen.indexOf('--base-url') + 1]).toBe('https://t3.nekomaneki.work');
  });

  it('成功したら、開くだけでログインできるURLと期限を返す(トークン単体は返さない)', async () => {
    const r = await issueT3Pairing(async () => T3_OUTPUT);
    expect(r).toEqual({ ok: true, pairUrl: 'https://t3.nekomaneki.work/pair#token=ABCDEF123456', expiresAt: '2026-10-31T10:05:00.000Z' });
  });

  it('CLIが失敗したら、原因と対処を返す(空にしない)', async () => {
    const r = await issueT3Pairing(async () => { throw new Error('spawn t3 ENOENT'); });
    expect(r.ok).toBe(false);
    expect(r.errorCode).toBe('cli_failed');
    expect(r.detail).toContain('ENOENT');
    expect(r.remedy.length).toBeGreaterThan(0);
  });

  it('出力が想定と違えば、別の版のT3を疑うよう伝える', async () => {
    for (const out of ['not json', JSON.stringify({ credential: 'x' }), JSON.stringify({ pairUrl: 'https://evil.example/pair#token=x', expiresAt: 'x' })]) {
      const r = await issueT3Pairing(async () => out);
      expect(r.ok).toBe(false);
      expect(r.errorCode).toBe('unexpected_output');
      expect(r.remedy).toContain('0.1.3');
    }
  });
});

describe('/cf-containers のワンクリックログイン', () => {
  const html = getCfContainersPage();
  it('ボタンがあり、コンテナ経由でペアリングを作って新しいタブで開く', () => {
    expect(html).toContain('id="btn-t3-login"');
    expect(html).toContain("fetch('/cf-containers/proxy/t3/pairing', { method: 'POST' })");
    expect(html).toContain('window.open(');
  });
  it('ページのscriptが構文エラーにならない', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cfc-'));
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
    expect(scripts.length).toBeGreaterThan(0);
    scripts.forEach((s, i) => { const f = join(dir, `s${i}.js`); writeFileSync(f, s); execFileSync(process.execPath, ['--check', f]); });
  });
});
