// 引き継ぎに失敗したとき、ボタンを押さなくても診断の結果が画面に出ることを、実際のブラウザで確かめる(ソースの文字列ではなく動作を検査する)。
// 偽のT3(3773相当)→本物の中継(t3-embed-proxy.cjs)→iframe の順につなぐ。Chromiumが無い環境ではスキップする。
import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
let chromium: { launch: (options?: unknown) => Promise<any> } | null = null;
try { chromium = require('playwright').chromium; } catch { chromium = null; }

// T3 0.1.3 の client/index.html と同じ形のscriptタグ(injectBootstrapが置き換える対象)。
const T3_HTML = '<!doctype html><html><head><script type="module" crossorigin src="/assets/index-BBHBqBtb.js"></script></head><body><div id="root"></div></body></html>';
const listen = (server: http.Server) => new Promise<number>(r => server.listen(0, '127.0.0.1', () => r((server.address() as AddressInfo).port)));

describe.skipIf(!chromium)('PWAの自動診断(実ブラウザ)', () => {
  it('失敗すると、操作なしで診断の各項目と対処が画面に出る', async () => {
    const t3 = http.createServer((req, res) => {
      if (req.url!.startsWith('/api/auth/session')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"authenticated":false}'); return; }
      if (req.url!.startsWith('/assets/')) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(''); return; }
      res.writeHead(200, { 'content-type': 'text/html' }); res.end(T3_HTML);
    });
    const upstreamPort = await listen(t3);
    const { createServer } = require('../containers/demo/t3-embed-proxy.cjs');
    const { createPwaAuth } = require('../containers/demo/t3-pwa-auth.cjs');
    const dir = mkdtempSync(join(tmpdir(), 't3pwa-'));
    const pwa = createPwaAuth({
      dbPath: join(dir, 'pwa.sqlite'), key: 'k'.repeat(64), generation: () => 'g',
      readConfig: () => { throw new Error('ENOENT: config.json'); },
      verifySession: async () => ({ authenticated: false }), listSessions: async () => [],
    });
    const proxy = createServer(pwa, { upstreamPort, resolveCookieName: async () => null });
    const proxyPort = await listen(proxy);
    const host = http.createServer((_q, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<iframe src="http://127.0.0.1:${proxyPort}/" width="800" height="600"></iframe>`); });
    // 中継のCSP(frame-ancestors)が埋め込みを許す開発用の親ページ http://127.0.0.1:4173 から開く。
    await new Promise<void>(r => host.listen(4173, '127.0.0.1', () => r()));
    const hostPort = 4173;
    // リポジトリのplaywrightの版に合うブラウザが無いときは、環境に入っているChromiumを使う。
    const browser = await chromium!.launch().catch(() => chromium!.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] } as never));
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${hostPort}/`);
      const frame = page.frames()[1];
      await frame.getByText('T3本体').waitFor({ timeout: 10000 });
      const text: string = await frame.evaluate(() => document.getElementById('pwa-connect')!.innerText);
      expect(text).toContain('引き継ぎの設定');
      expect(text).toContain('このブラウザのT3のログイン');
      expect(text).toContain('対処:');
      expect(text).not.toContain('確認中…');
      expect(await frame.getByText('状態を確認する').count()).toBe(0);
    } finally {
      await browser.close(); proxy.close(); t3.close(); host.close(); pwa.close();
    }
  }, 40000);
});
