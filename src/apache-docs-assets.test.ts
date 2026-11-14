import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { APACHE_DOCS_VERSION, APACHE_DOCS_PAGES, apacheDocPageFor } from './utils/apacheDocsIndex';

// ユーザー指定(2026-11-14): Apacheのソースにあるモジュールのドキュメントを本体Workerの静的アセットに置き、
// /cf-containers のモーダルからiframeで読む。公式サイトは frame-ancestors 'self' のため埋め込めない。
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public/apache-docs', APACHE_DOCS_VERSION);
// タグ1つ(属性の値の中の < > で途切れない)
const TAG = /<[a-zA-Z](?:[^<>"']|"[^"]*"|'[^']*')*>/g;

describe('Apacheモジュールのドキュメント(静的アセット)', () => {
  it('版はリポジトリに置いたApacheのソースと同じ', () => {
    expect(existsSync(join(ROOT, 'containers/demo/packages', `httpd-${APACHE_DOCS_VERSION}.tar.gz`))).toBe(true);
  });

  it('一覧のページがすべてファイルとしてあり、英語版は必ずある', () => {
    const names = Object.keys(APACHE_DOCS_PAGES);
    expect(names.length).toBeGreaterThan(100);
    for (const [page, langs] of Object.entries(APACHE_DOCS_PAGES)) {
      expect(langs, page).toContain('en');
      for (const lang of langs) expect(existsSync(join(OUT, 'mod', `${page}.${lang}.html`)), `${page}.${lang}`).toBe(true);
    }
    expect(APACHE_DOCS_PAGES.mod_ssl).toEqual(['en']);
    expect(APACHE_DOCS_PAGES.mod_headers).toEqual(['en', 'ja']);
    expect(APACHE_DOCS_PAGES.event).toEqual(['en']);
  });

  it('モジュール名からページを選ぶ。mpm系はevent・prefork・worker、日本語版があれば日本語版、無ければ英語版', () => {
    expect(apacheDocPageFor('ssl')).toBe(`/apache-docs/${APACHE_DOCS_VERSION}/mod/mod_ssl.en.html`);
    expect(apacheDocPageFor('headers')).toBe(`/apache-docs/${APACHE_DOCS_VERSION}/mod/mod_headers.ja.html`);
    expect(apacheDocPageFor('mpm_event')).toBe(`/apache-docs/${APACHE_DOCS_VERSION}/mod/event.en.html`);
    expect(apacheDocPageFor('mpm_prefork')).toBe(`/apache-docs/${APACHE_DOCS_VERSION}/mod/prefork.ja.html`);
    expect(apacheDocPageFor('ssl_module')).toBe(`/apache-docs/${APACHE_DOCS_VERSION}/mod/mod_ssl.en.html`);
    expect(apacheDocPageFor('made_up')).toBeNull();
  });

  it('ページの中に、言語の決まらないリンクやmod/の外への相対リンクを残さない', () => {
    const files = readdirSync(join(OUT, 'mod')).filter((f) => f.endsWith('.html'));
    for (const file of files) {
      const html = readFileSync(join(OUT, 'mod', file), 'utf8');
      // 実際のタグの属性だけを見る(本文の例は &lt;img src=…&gt; のようにエスケープされている)
      const hrefs = (html.match(TAG) || []).map((tag) => tag.match(/\shref="([^"]*)"/)?.[1]).filter((v): v is string => v !== undefined);
      for (const href of hrefs) {
        if (/^(https?:|mailto:|#)/.test(href)) continue;
        expect(/^\.\.\/(style|images)\/|^[a-z0-9_-]+\.(en|ja)\.html(#.*)?$/.test(href), `${file}: ${href}`).toBe(true);
        if (/^\.\.\/(style|images)\//.test(href)) expect(existsSync(join(OUT, href.slice(3))), `${file}: ${href}`).toBe(true);
      }
      const srcs = (html.match(TAG) || []).map((tag) => tag.match(/\ssrc="([^"]*)"/)?.[1]).filter((v): v is string => v !== undefined);
      for (const src of srcs) {
        expect(/^\.\.\/(images|style)\//.test(src), `${file}: ${src}`).toBe(true);
        expect(existsSync(join(OUT, src.slice(3))), `${file}: ${src}`).toBe(true);
      }
    }
  });

  it('本文の例(エスケープされたタグ)のリンクは書き換えない', () => {
    const files = readdirSync(join(OUT, 'mod')).filter((f) => f.endsWith('.html'));
    for (const file of files) {
      const html = readFileSync(join(OUT, 'mod', file), 'utf8');
      expect(/&lt;[^&<>]*noopener noreferrer/.test(html), file).toBe(false);
    }
    expect(readFileSync(join(OUT, 'mod', 'mod_imagemap.en.html'), 'utf8')).toContain('&lt;a href="/maps/imagemap1.map"&gt;');
  });

  it('参照している画像・CSS・scriptと、LICENSE・NOTICEがある', () => {
    for (const f of ['style/css/manual.css', 'style/css/prettify.css', 'style/scripts/prettify.min.js', 'images/feather.png', 'images/down.gif', 'LICENSE.txt', 'NOTICE.txt']) {
      expect(existsSync(join(OUT, f)), f).toBe(true);
    }
  });

  it('同じオリジンのiframeでだけ表示できるヘッダーを付ける', () => {
    const headers = readFileSync(join(ROOT, 'public/_headers'), 'utf8');
    const block = headers.slice(headers.indexOf('/apache-docs/*'));
    expect(block).toContain('X-Frame-Options: SAMEORIGIN');
    expect(block).toContain("Content-Security-Policy: frame-ancestors 'self'");
  });

  it('書き出しは、リポジトリのソースから同じ内容を作り直せる', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apache-docs-'));
    try {
      execFileSync('node', [join(ROOT, 'scripts/build-apache-docs.mjs'), '--out', dir, '--index', join(dir, 'index.ts')], { cwd: ROOT, stdio: 'pipe' });
      for (const f of ['mod/mod_ssl.en.html', 'mod/mod_headers.ja.html', 'mod/index.en.html']) {
        expect(readFileSync(join(dir, APACHE_DOCS_VERSION, f), 'utf8'), f).toBe(readFileSync(join(OUT, f), 'utf8'));
      }
      expect(readFileSync(join(dir, 'index.ts'), 'utf8')).toBe(readFileSync(join(ROOT, 'src/utils/apacheDocsIndex.ts'), 'utf8'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
