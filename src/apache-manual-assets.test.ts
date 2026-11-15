import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { APACHE_MANUAL_VERSION, APACHE_MANUAL_BASE } from './data/apacheManual';

// 対象: public/apache-manual/<版>/(scripts/extract-apache-manual.py がApacheのソースから展開した、
// モジュールのマニュアルとmodules.json)。/cf-containers のモジュール名から開くヘルプに使う。
//
// 故障シナリオ:
//   (1) コンテナのApacheの版を上げたのにマニュアルが古いまま(版の食い違い)
//   (2) コンテナが必ず入れるモジュールの説明が無く、ヘルプのリンクが出ない
//   (3) modules.json が指すファイルが無く、iframeが404になる
//   (4) MPM(mpm_event)のようにファイル名とモジュール名が違うものを対応付けられない
//   (5) マニュアルが外部のscriptを読む、または外部リンクがiframeの中で開いてしまう
//   (6) iframeで表示できない(フレームの許可が無い)、またはライセンス表記が欠ける

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'public', APACHE_MANUAL_BASE);
const index = JSON.parse(fs.readFileSync(path.join(DIR, 'modules.json'), 'utf8')) as {
  apacheVersion: string;
  sha512: string;
  modules: Record<string, { file: string; description: string; identifier: string; directives: { name: string; syntax: string }[] }>;
};
const REQUIRED = ['ssl', 'proxy', 'proxy_http', 'proxy_wstunnel', 'rewrite', 'cgid', 'include', 'remoteip', 'mpm_event'];

describe('Apacheマニュアルの静的アセット', () => {
  it('版がコンテナのApache(Dockerfile の ARG APACHE_VERSION)と一致する', () => {
    const dockerfile = fs.readFileSync(path.join(ROOT, 'containers/demo/Dockerfile'), 'utf8');
    const pinned = dockerfile.match(/^ARG APACHE_VERSION=(\S+)$/m)?.[1];
    expect(pinned).toBe(APACHE_MANUAL_VERSION);
    expect(index.apacheVersion).toBe(APACHE_MANUAL_VERSION);
    expect(index.sha512).toMatch(/^[0-9a-f]{128}$/);
  });

  it('コンテナが必ず入れるモジュールに説明とファイルがある', () => {
    for (const name of REQUIRED) {
      const entry = index.modules[name];
      expect(entry, name).toBeTruthy();
      expect(entry.description.length, name).toBeGreaterThan(0);
      expect(entry.identifier).toBe(name + '_module');
    }
  });

  it('mpm_eventはevent.htmlに対応付けられ、ディレクティブの構文を持つ', () => {
    expect(index.modules.mpm_event.file).toBe('mod/event.html');
    const rewrite = index.modules.rewrite.directives.find((d) => d.name === 'RewriteEngine');
    expect(rewrite?.syntax).toBe('RewriteEngine on|off');
  });

  it('modules.json が指すファイルはすべて存在する', () => {
    for (const [name, entry] of Object.entries(index.modules)) {
      expect(fs.existsSync(path.join(DIR, entry.file)), name).toBe(true);
    }
  });

  it('外部のscriptを読まず、外部リンクは新しいタブで開き、mod/の外への相対リンクを残さない', () => {
    for (const file of fs.readdirSync(path.join(DIR, 'mod'))) {
      const page = fs.readFileSync(path.join(DIR, 'mod', file), 'utf8');
      expect(page, file).not.toMatch(/<script[^>]+src="(https?:)?\/\//);
      for (const tag of page.match(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/g) || []) {
        expect(tag, file).toContain('target="_blank"');
        expect(tag, file).toMatch(/rel="[^"]*noopener/);
      }
      for (const url of page.match(/(?:href|src)="\.\.\/([^"]*)"/g) || []) {
        expect(url, file).toMatch(/="\.\.\/(mod|style|images)\//);
      }
    }
  });

  it('参照している画像・スタイルがあり、LICENSE・NOTICEを同梱している', () => {
    const page = fs.readFileSync(path.join(DIR, 'mod', 'mod_ssl.html'), 'utf8');
    for (const ref of page.match(/="\.\.\/((?:style|images)\/[^"]+)"/g) || []) {
      const rel = ref.slice(5, -1);
      expect(fs.existsSync(path.join(DIR, rel)), rel).toBe(true);
    }
    expect(fs.existsSync(path.join(DIR, 'LICENSE'))).toBe(true);
    expect(fs.existsSync(path.join(DIR, 'NOTICE'))).toBe(true);
  });

  it('_headersで同じオリジンのiframeだけに表示を許す', () => {
    const headers = fs.readFileSync(path.join(ROOT, 'public/_headers'), 'utf8');
    const block = headers.split(/\n(?=\S)/).find((b) => b.startsWith('/apache-manual/*'));
    expect(block).toBeTruthy();
    expect(block).toContain('X-Frame-Options: SAMEORIGIN');
    expect(block).toContain("frame-ancestors 'self'");
    expect(block).toContain('X-Content-Type-Options: nosniff');
  });
});
