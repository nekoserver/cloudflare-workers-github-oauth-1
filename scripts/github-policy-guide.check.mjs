import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { Script, runInNewContext } from 'node:vm';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const guide = join(root, 'public/github-policy-guide');
const read = (path) => readFileSync(path, 'utf8');
const data = () => JSON.parse(read(join(root, 'scripts/github-policy-guide-data.json')));
const htmlFiles = () => [join(guide, 'index.html'), ...data().groups.map(g => join(guide, g.slug, 'index.html'))];

test('14分類と234項目が欠落・重複なく、元のYes/Noとともに配信される', () => {
  const catalog = data();
  assert.equal(catalog.groups.length, 14);
  assert.equal(catalog.questions.length, 234);
  const members = catalog.groups.flatMap(g => g.question_ids);
  assert.equal(new Set(members).size, 234);
  assert.deepEqual([...members].sort(), catalog.questions.map(q => q.id).sort());
  for (const group of catalog.groups) {
    const html = read(join(guide, group.slug, 'index.html'));
    for (const id of group.question_ids) {
      assert.equal(html.split('id="' + id + '"').length - 1, 1, id);
      const question = catalog.questions.find(q => q.id === id);
      assert.ok(html.includes(question.statement), id);
    }
    assert.ok(html.includes('規約の記述としての正解'));
    assert.ok(html.includes('適合・不適合の判定結果ではありません'));
  }
});

test('左メニューの14リンクが同一オリジンの実在するディレクトリを右フレームに開く', () => {
  const html = read(join(guide, 'index.html'));
  const links = [...html.matchAll(/<a\b([^>]*data-group="[^"]+"[^>]*)>/g)];
  assert.equal(links.length, 14);
  assert.match(html, /<iframe\b[^>]*name="policy-content"[^>]*title="[^"]+"/);
  for (const [, attrs] of links) {
    assert.match(attrs, /target="policy-content"/);
    const href = attrs.match(/href="([^"]+)"/)[1];
    assert.match(href, /^\.\/[a-z0-9-]+\/$/);
    assert.ok(existsSync(resolve(guide, href, 'index.html')), href);
  }
});

test('各ページに日本語要約・証拠・判断の限界・原文リンクがある', () => {
  for (const group of data().groups) {
    const html = read(join(guide, group.slug, 'index.html'));
    for (const heading of ['日本語要約', '確認する証拠', '判断の限界', '公式原文']) assert.ok(html.includes(heading), group.group_id + heading);
    assert.match(html, /https:\/\/docs\.github\.com\/en\/site-policy\//);
    assert.ok(group.summary.length >= 3);
    for (const paragraph of group.summary) assert.ok(html.includes(paragraph));
  }
});

test('入口と全要約のインラインJavaScriptに構文エラーがなく、インラインイベントを使わない', () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    assert.doesNotMatch(html, /\son(?:click|change|load|error)\s*=/i);
    for (const [, js] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Script(js, { filename: file });
    assert.doesNotMatch(html, /<script\b[^>]*src=/i);
    assert.doesNotMatch(html, /<link\b[^>]*rel="stylesheet"/i);
  }
});

test('不明な分類や細工されたハッシュは先頭分類に戻し、正しい分類は維持する', () => {
  const html = read(join(guide, 'index.html'));
  const js = html.match(/<script id="policy-navigation-model">([\s\S]*?)<\/script>/)[1];
  const context = {};
  runInNewContext(js, context);
  for (const group of data().groups) assert.equal(context.resolvePolicyGroup('#' + group.group_id), group.group_id);
  for (const hash of ['', '#unknown', '#../../', '#javascript:alert(1)', '#R01%22']) assert.equal(context.resolvePolicyGroup(hash), 'R01');
});

test('全HTMLの内部リンクが解決でき、外部リンクは安全に別タブで開く', () => {
  for (const file of htmlFiles()) {
    const html = read(file);
    for (const [, attrs, href] of html.matchAll(/<a\b([^>]*href="([^"]+)"[^>]*)>/g)) {
      if (href.startsWith('https://')) {
        assert.match(attrs, /target="_blank"/);
        assert.match(attrs, /rel="noopener noreferrer"/);
      } else if (href.startsWith('#')) {
        assert.ok(html.includes('id="' + href.slice(1) + '"'), href);
      } else {
        const target = resolve(dirname(file), href);
        assert.ok(target === guide || target.startsWith(guide + '/'), href);
        assert.ok(existsSync(href.endsWith('/') ? join(target, 'index.html') : target), href);
      }
    }
  }
});

test('ライト・ダーク両方のパレットとモバイルメニューがあり、大見出しを折りたためる', () => {
  const entry = read(join(guide, 'index.html'));
  assert.match(entry, /--nav-width:\s*240px/);
  assert.match(entry, /id="menu-toggle"/);
  assert.match(entry, /aria-controls="policy-navigation"/);
  assert.match(entry, /max-width:\s*800px/);
  for (const file of htmlFiles()) {
    const html = read(file);
    assert.match(html, /prefers-color-scheme:\s*dark/);
    assert.match(html, /name="viewport"/);
    const headings = [...html.matchAll(/<h2\b/g)].length;
    assert.ok(headings > 0);
    assert.equal(headings, [...html.matchAll(/<details class="phase-details(?: [^"]+)?" open>\s*<summary><h2/g)].length);
    const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const definitions = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
    for (const [, variable] of css.matchAll(/var\((--[\w-]+)\)/g)) assert.ok(definitions.has(variable), variable);
  }
});

test('初期表示に実在する要約を指定し、JavaScriptなしでも分類を選択できる', () => {
  const html = read(join(guide, 'index.html'));
  const src = html.match(/<iframe\b[^>]*src="([^"]+)"/)[1];
  assert.ok(existsSync(resolve(guide, src, 'index.html')));
  assert.match(html, /<noscript>/);
  assert.match(html, /id="policy-content-heading"/);
  assert.equal(readdirSync(guide, { withFileTypes: true }).filter(x => x.isDirectory()).length, 14);
});
