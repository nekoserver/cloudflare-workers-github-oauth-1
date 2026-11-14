#!/usr/bin/env node
// Apache httpd のソース(containers/demo/packages/httpd-<版>.tar.gz)にあるモジュールのドキュメント(docs/manual/mod)を、
// 本体Workerの静的アセット(public/apache-docs/<版>/)へ書き出す(ユーザー指定、2026-11-14)。
// /cf-containers のApacheモジュールのモーダルから、同じオリジンのiframeで読む。公式サイトは frame-ancestors 'self' で埋め込めない。
//
//   node scripts/build-apache-docs.mjs [--out public/apache-docs] [--index src/utils/apacheDocsIndex.ts]
//
// - 英語版(.html.en)と日本語版(.html.ja.utf8)だけを <page>.en.html・<page>.ja.html として置く
// - mod/ の中のページ同士のリンクは同じ言語の版へ(その言語が無ければ英語版)。mod/ の外と英日以外の言語は公式サイトを新しいタブで開く
// - CSS・script・参照している画像、LICENSE・NOTICE(Apache License 2.0)を一緒に置く
// - ページと言語の一覧を src/utils/apacheDocsIndex.ts に書き出す。何度実行しても同じ内容になる
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
const OUT_ROOT = opt('--out', join(ROOT, 'public/apache-docs'));
const INDEX = opt('--index', join(ROOT, 'src/utils/apacheDocsIndex.ts'));
const OFFICIAL = 'https://httpd.apache.org/docs/2.4/';

const PACKAGES = join(ROOT, 'containers/demo/packages');
const tarballs = readdirSync(PACKAGES).filter((f) => /^httpd-\d+\.\d+\.\d+\.tar\.gz$/.test(f));
if (tarballs.length !== 1) throw new Error(`httpd-<版>.tar.gz が1つではありません: ${tarballs.join(', ') || 'なし'}`);
const VERSION = tarballs[0].match(/^httpd-(.+)\.tar\.gz$/)[1];
const SRC = `httpd-${VERSION}`;

const work = mkdtempSync(join(tmpdir(), 'apache-docs-src-'));
try {
  execFileSync('tar', ['xzf', join(PACKAGES, tarballs[0]), '-C', work,
    `${SRC}/docs/manual/mod`, `${SRC}/docs/manual/style/css`, `${SRC}/docs/manual/style/scripts`, `${SRC}/docs/manual/images`,
    `${SRC}/LICENSE`, `${SRC}/NOTICE`]);
  const manual = join(work, SRC, 'docs/manual');
  const modDir = join(manual, 'mod');
  const files = readdirSync(modDir).sort();
  const pages = {};
  for (const f of files) {
    let m = f.match(/^(.+)\.html\.en$/);
    if (m) (pages[m[1]] ||= []).push('en');
    m = f.match(/^(.+)\.html\.ja\.utf8$/);
    if (m) (pages[m[1]] ||= []).push('ja');
  }
  for (const name of Object.keys(pages)) pages[name] = ['en', 'ja'].filter((l) => pages[name].includes(l));
  for (const name of Object.keys(pages)) if (!pages[name].includes('en')) delete pages[name];
  const names = Object.keys(pages).sort();

  const pageHref = (page, lang, frag) => {
    const l = pages[page].includes(lang) ? lang : 'en';
    return `${page}.${l}.html${frag}`;
  };
  // ページの中のリンク1つを、置き場所に合わせて書き換える。外へ出すものは [url, true] を返す。
  const mapHref = (href, lang) => {
    if (/^(https?:|mailto:|#)/.test(href)) return [href, /^https?:/.test(href)];
    const hash = href.indexOf('#');
    const frag = hash === -1 ? '' : href.slice(hash);
    let path = (hash === -1 ? href : href.slice(0, hash)).replace(/^\.\//, '');
    let target = lang;
    const langPath = path.match(/^\.\.\/(en|ja)\/mod\/(.*)$/);
    if (langPath) { target = langPath[1]; path = langPath[2]; }
    else if (path.startsWith('../mod/')) path = path.slice('../mod/'.length);
    if (path === '' ) return [pageHref('index', target, frag), false];
    if (path.startsWith('../style/') || path.startsWith('../images/')) return [path + frag, false];
    const page = path.match(/^([a-z0-9_-]+)\.html$/);
    if (page && pages[page[1]]) return [pageHref(page[1], target, frag), false];
    if (page) return [`${OFFICIAL}mod/${path}${frag}`, true];
    if (path.startsWith('../')) return [OFFICIAL + path.replace(/^(\.\.\/)+/, '') + frag, true];
    return [`${OFFICIAL}mod/${path}${frag}`, true];
  };
  // タグ1つ。属性の値の中の < > (例: href="…#<satisfyall>")で途切れないよう、引用符の中は飛ばす。
  const TAG = /<[a-zA-Z](?:[^<>"']|"[^"]*"|'[^']*')*>/g;
  // 実際のタグの中のhrefだけを書き換える。本文の例は &lt;a href=…&gt; とエスケープされているので触らない。
  const rewrite = (html, lang) => html.replace(TAG, (tag) => tag.replace(/(\s)href="([^"]*)"/, (_, sp, href) => {
    const [url, external] = mapHref(href, lang);
    return external ? `${sp}href="${url}" target="_blank" rel="noopener noreferrer"` : `${sp}href="${url}"`;
  }));

  const out = join(OUT_ROOT, VERSION);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, 'mod'), { recursive: true });
  const images = new Set();
  for (const name of names) {
    for (const lang of pages[name]) {
      const source = join(modDir, `${name}.html.${lang === 'en' ? 'en' : 'ja.utf8'}`);
      const html = rewrite(readFileSync(source, 'utf8'), lang);
      for (const tag of html.match(TAG) || []) { const m = tag.match(/\s(?:src|href)="\.\.\/images\/([^"#]+)"/); if (m) images.add(m[1]); }
      writeFileSync(join(out, 'mod', `${name}.${lang}.html`), html);
    }
  }
  for (const dir of ['style/css', 'style/scripts']) {
    mkdirSync(join(out, dir), { recursive: true });
    for (const f of readdirSync(join(manual, dir)).sort()) {
      if (/\.(css|js)$/.test(f)) copyFileSync(join(manual, dir, f), join(out, dir, f));
    }
  }
  mkdirSync(join(out, 'images'), { recursive: true });
  for (const f of [...images].sort()) {
    if (!existsSync(join(manual, 'images', f))) throw new Error(`参照している画像がソースにありません: ${f}`);
    copyFileSync(join(manual, 'images', f), join(out, 'images', f));
  }
  copyFileSync(join(work, SRC, 'LICENSE'), join(out, 'LICENSE.txt'));
  copyFileSync(join(work, SRC, 'NOTICE'), join(out, 'NOTICE.txt'));

  const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
  const lines = names.map((n) => `  ${key(n)}: [${pages[n].map((l) => `'${l}'`).join(', ')}],`);
  mkdirSync(dirname(INDEX), { recursive: true });
  writeFileSync(INDEX, `// このファイルは scripts/build-apache-docs.mjs が書き出す。手で直さない。
// Apache httpd ${VERSION} のソース(containers/demo/packages/httpd-${VERSION}.tar.gz)の docs/manual/mod にあるページと言語。
// ページは public/apache-docs/${VERSION}/mod/<ページ>.<言語>.html にある。
export const APACHE_DOCS_VERSION = '${VERSION}';

export const APACHE_DOCS_PAGES: Readonly<Record<string, readonly ('en' | 'ja')[]>> = {
${lines.join('\n')}
};

/** モジュール名(ssl・mpm_event・ssl_moduleなど)から静的アセットのページのパスを返す。日本語版があれば日本語版。無ければnull。 */
export function apacheDocPageFor(name: string): string | null {
  const base = String(name || '').replace(/_module$/, '');
  const page = base.startsWith('mpm_') && APACHE_DOCS_PAGES[base.slice(4)] ? base.slice(4) : 'mod_' + base;
  const langs = APACHE_DOCS_PAGES[page];
  if (!langs) return null;
  return \`/apache-docs/\${APACHE_DOCS_VERSION}/mod/\${page}.\${langs.includes('ja') ? 'ja' : 'en'}.html\`;
}
`);
  const count = names.reduce((n, p) => n + pages[p].length, 0);
  console.log(`apache-docs: ${VERSION} ${names.length}ページ(${count}ファイル)、画像${images.size}個 -> ${out}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
