import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getCfContainersPage } from './views/cfContainers';

// 対象: /cf-containers のヘルスチェック表の Apache 欄と、コンテナ内 server.js の /health の Apache 探査。
// 経緯: 2026-11-18、Apache は 8443(トンネル側)で動いているのに lib 専用の 8445 が立っておらず、
// lib 経路だけが ECONNREFUSED になった。ヘルスチェックが Apache を 8443 だけで判定していたため、
// 8445 の不在が画面では見えなかった。ユーザー指示(2026-11-18): Apache 欄を 8443/8445 の両カラムに
// 分けてヘルスチェックする。
// 故障想定: 片方のポートだけ落ちているのに Apache 欄が OK になる / 表示ポートと server.js の
// LIB_PORT がずれる / 古いイメージ(apacheLib を返さない)で欄が NG と誤表示される。

const serverJs = readFileSync('containers/demo/server.js', 'utf8');
const libConf = readFileSync('containers/demo/apache-lib.conf', 'utf8');
const libPort = serverJs.match(/const LIB_PORT = (\d+);/)![1];

function buildHealthBody(): string {
  const i = serverJs.indexOf('async function buildHealth()');
  expect(i).toBeGreaterThanOrEqual(0);
  return serverJs.slice(i, serverJs.indexOf('\n}\n', i));
}

describe('server.js の /health は Apache を 8443 と lib 専用ポートで別々に探査する', () => {
  it('buildHealth が 8443 と LIB_PORT の両方を probeTcp する', () => {
    const body = buildHealthBody();
    expect(body).toContain('probeTcp(8443)');
    expect(body).toMatch(/probeTcp\(LIB_PORT\)|probeTcp\(8445\)/);
  });

  it('結果に apache(8443) と apacheLib(lib 専用ポート) を分けて返す', () => {
    const body = buildHealthBody();
    expect(body).toMatch(/apache: value\(/);
    expect(body).toMatch(/apacheLib: value\(/);
  });
});

describe('/cf-containers のヘルスチェック表は Apache を2カラムで表示する', () => {
  const html = getCfContainersPage();

  it('見出しに Apache(8443) と Apache lib(LIB_PORT) の両方がある', () => {
    expect(html).toContain('<th>Apache(8443)</th>');
    expect(html).toContain(`<th>Apache lib(${libPort})</th>`);
  });

  it('セル health-apache と health-apache-lib の両方がある', () => {
    expect(html).toContain('id="health-apache"');
    expect(html).toContain('id="health-apache-lib"');
  });

  it('ページスクリプトが data.apacheLib を health-apache-lib に描く', () => {
    expect(html).toMatch(/getElementById\('health-apache-lib'\)/);
    expect(html).toContain('data.apacheLib');
  });

  it('表示ポートは apache-lib.conf の Listen と一致する', () => {
    const listen = libConf.match(/^Listen 127\.0\.0\.1:(\d+)$/m)![1];
    expect(html).toContain(`<th>Apache lib(${listen})</th>`);
  });
});
