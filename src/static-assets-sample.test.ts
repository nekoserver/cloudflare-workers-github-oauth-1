// Workers Static Assets のサンプルページ(2026-11-13、ユーザー指定)。
// 仮説: public/ に置いたファイルは Worker のコードを通らずに配信され、一致しないパスだけが Worker に渡る。
//   1. ページの HTML・CSS・JS が public/static-assets-sample/ にあり、HTML は外部の CSS と JS だけを読む(インラインの script・style が無い)
//   2. 一致するファイルが無い /api/static-assets-sample は Worker が JSON で答える(served_by: "worker")
//   3. _headers で、サンプルのファイルに X-Static-Asset-Sample ヘッダーを付ける
//   4. ページのスクリプトは構文が正しい
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import app from './index';

const DIR = 'public/static-assets-sample';

describe('Workers Static Assets のサンプルページ', () => {
  it('HTML・CSS・JS を public/ に置き、HTML は外部の CSS と JS だけを読む', () => {
    for (const f of ['index.html', 'style.css', 'app.js']) expect(existsSync(`${DIR}/${f}`), f).toBe(true);
    const html = readFileSync(`${DIR}/index.html`, 'utf8');
    expect(html).toContain('<link rel="stylesheet" href="/static-assets-sample/style.css">');
    expect(html).toContain('<script src="/static-assets-sample/app.js" defer></script>');
    expect(html).not.toMatch(/<script>(?!<\/script>)/);
    expect(html).not.toMatch(/<style>|style="/);
  });

  it('一致するファイルが無い /api/static-assets-sample は Worker が JSON で答える', async () => {
    const res = await app.request('/api/static-assets-sample', {}, {} as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { served_by: string; path: string; time: string };
    expect(body.served_by).toBe('worker');
    expect(body.path).toBe('/api/static-assets-sample');
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });

  it('_headers でサンプルのファイルに X-Static-Asset-Sample ヘッダーを付ける', () => {
    expect(readFileSync('public/_headers', 'utf8')).toMatch(/^\/static-assets-sample\/\*\n {2}X-Static-Asset-Sample: served-from-assets$/m);
  });

  it('ページのスクリプトは構文が正しい', () => {
    expect(() => execFileSync('node', ['--check', `${DIR}/app.js`])).not.toThrow();
  });
});
