import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getLoginPage } from './views/login';

const indexSrc = readFileSync(resolve(__dirname, 'index.ts'), 'utf-8');

describe('失効したAPIキーの一覧表示期間', () => {
  it('失効後7日以内だけGET /api/api-keysの一覧に含める', () => {
    const start = indexSrc.indexOf("app.get('/api/api-keys'");
    const block = indexSrc.slice(start, start + 1800);
    expect(block).toContain('Date.now() - 7 * 24 * 60 * 60 * 1000');
    expect(block).toContain('(revoked_at IS NULL OR revoked_at > ?)');
    expect(block).toContain('.bind(user.sub, revokedKeyVisibleAfter)');
  });
});

describe('ログインページの失効公開鍵', () => {
  const html = getLoginPage();

  it('サーバーで現在利用可能と確認できた公開鍵だけをボタン表示する', () => {
    expect(indexSrc).toContain("app.post('/auth/public-key/available', async (c) => {");
    const endpointStart = indexSrc.indexOf("app.post('/auth/public-key/available'");
    const endpoint = indexSrc.slice(endpointStart, endpointStart + 2200);
    expect(endpoint).toContain('revoked_at IS NULL');
    expect(endpoint).toContain('(expires_at IS NULL OR expires_at > ?)');
    expect(html).toContain("fetch('/auth/public-key/available'");
    expect(html).toContain('listLocalKeys().then(filterAvailableKeys)');
  });

  it('状態照会に失敗した場合は失効鍵を誤表示しない', () => {
    expect(html).toContain("if (!r.ok) return []");
    expect(html).toContain(".catch(function() { return []; })");
  });

  it('埋め込みスクリプトに構文エラーがない', () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    scripts.forEach((script) => expect(() => new Function(script[1])).not.toThrow());
  });
});
