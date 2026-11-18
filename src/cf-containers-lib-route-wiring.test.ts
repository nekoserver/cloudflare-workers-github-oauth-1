import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// 対象: demoコンテナの lib(SSI)経路の配線。server.js の内部プロキシ先(127.0.0.1 の lib 専用ポート)、
// apache-lib.conf の VirtualHost、Dockerfile での配置と有効化、apache-demo.conf(トンネル側 8443)の /lib 拒否。
// 経緯: 2026-11-18、イメージ側の版の不一致(CLAUDE_NATIVE_SHA256)を直して新イメージで再作成した後も
// /cf-containers/proxy/lib/* が ECONNREFUSED になった。server.js は lib 専用ポートへプロキシするが、
// そのポートで待ち受ける VirtualHost が有効でないと、Apache が 8443 で動いていても lib だけ届かない。
// この種の食い違い(プロキシ先ポート・Listen・サイト有効化・公開側の拒否)は、実リポジトリのファイル同士を
// 突き合わせる前提チェックで炙り出す(フィクスチャではなく実物を見る。2026-11-18、利用者指示)。
// 故障想定: LIB_PORT と Listen の不一致 / apache-lib.conf を置いたが a2ensite し忘れる /
// 8443 側の /lib 拒否が外れてトンネルから lib が見える / lib の VirtualHost がループバック以外で待ち受ける。

const serverJs = readFileSync('containers/demo/server.js', 'utf8');
const libConf = readFileSync('containers/demo/apache-lib.conf', 'utf8');
const demoConf = readFileSync('containers/demo/apache-demo.conf', 'utf8');
const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');
const entrypoint = readFileSync('containers/demo/entrypoint.sh', 'utf8');

describe('前提チェック: lib経路の配線(server.js → Apache lib VirtualHost)', () => {
  it('server.js の LIB_PORT と apache-lib.conf の Listen / VirtualHost のポートが一致する', () => {
    const libPort = serverJs.match(/const LIB_PORT = (\d+);/);
    expect(libPort, 'server.js に LIB_PORT の定義が無い').toBeTruthy();
    const listen = libConf.match(/^Listen 127\.0\.0\.1:(\d+)$/m);
    expect(listen, 'apache-lib.conf に 127.0.0.1 の Listen が無い').toBeTruthy();
    const vhost = libConf.match(/<VirtualHost 127\.0\.0\.1:(\d+)>/);
    expect(vhost, 'apache-lib.conf に 127.0.0.1 の VirtualHost が無い').toBeTruthy();
    expect(listen![1]).toBe(libPort![1]);
    expect(vhost![1]).toBe(libPort![1]);
  });

  it('lib の VirtualHost はループバックでのみ待ち受け、ワイルドカードの Listen を持たない', () => {
    expect(libConf).not.toMatch(/^Listen (?!127\.0\.0\.1:)/m);
    expect(libConf).not.toMatch(/<VirtualHost \*:/);
  });

  it('lib のディレクトリは SSI(#exec)と CGI を許可し、Require local に絞る', () => {
    const dir = libConf.slice(libConf.indexOf('<Directory /var/www/html/lib>'));
    expect(dir).toMatch(/Options [^\n]*\+Includes/);
    expect(dir).toMatch(/Options [^\n]*\+ExecCGI/);
    expect(dir).toMatch(/AddOutputFilter INCLUDES \.shtml/);
    expect(dir).toMatch(/AddHandler cgi-script \.cgi/);
    expect(dir).toMatch(/Require local/);
  });
});

describe('前提チェック: Dockerfile が lib の VirtualHost を配置し有効化する', () => {
  it('apache-lib.conf を sites-available の 010-lib.conf として配置する', () => {
    expect(dockerfile).toMatch(/^COPY apache-lib\.conf \/etc\/apache2\/sites-available\/010-lib\.conf$/m);
    expect(dockerfile).toMatch(/^COPY apache-demo\.conf \/etc\/apache2\/sites-available\/000-demo\.conf$/m);
  });

  it('最終ステージで COPY の後に a2ensite 000-demo 010-lib を実行する', () => {
    const finalStage = dockerfile.slice(dockerfile.lastIndexOf('\nFROM '));
    const copyAt = finalStage.indexOf('COPY apache-lib.conf');
    const ensite = finalStage.match(/a2ensite ([^\n\\]+)/);
    expect(ensite, '最終ステージに a2ensite が無い').toBeTruthy();
    expect(copyAt).toBeGreaterThanOrEqual(0);
    expect(finalStage.indexOf('a2ensite')).toBeGreaterThan(copyAt);
    expect(ensite![1]).toContain('000-demo');
    expect(ensite![1]).toContain('010-lib');
  });
});

describe('前提チェック: トンネル側(8443)は lib を拒否したままである', () => {
  it('apache-demo.conf は /lib を含む LocationMatch で Require all denied を維持する', () => {
    const loc = demoConf.match(/<LocationMatch "[^"]*lib[^"]*">([\s\S]*?)<\/LocationMatch>/);
    expect(loc, 'apache-demo.conf に /lib を含む LocationMatch が無い').toBeTruthy();
    expect(loc![1]).toMatch(/Require all denied/);
  });

  it('apache-demo.conf の待ち受けは 8443 で、lib 専用ポートと重ならない', () => {
    const libPort = serverJs.match(/const LIB_PORT = (\d+);/)![1];
    expect(demoConf).toMatch(/^Listen 8443$/m);
    expect(demoConf).not.toContain(`:${libPort}`);
  });
});

// REQ-LW-010: 証明書は自己署名で検証もされないため、起動時の毎回生成は失敗の分岐だけを生む。
// ビルド時に焼き込み、最終形の設定はビルド時の configtest で落とす(落ちる設定はイメージにならない)。
describe('前提チェック: 証明書の焼き込みと最終形 configtest (REQ-LW-010)', () => {
  it('Dockerfile がビルド時に自己署名証明書を /etc/apache2/tls へ生成する', () => {
    expect(dockerfile).toMatch(/openssl req -x509/);
    expect(dockerfile).toContain('-keyout /etc/apache2/tls/nekoroot.key');
    expect(dockerfile).toContain('-out /etc/apache2/tls/nekoroot.crt');
  });

  it('証明書生成と最終形の apache2 -t は、最終ステージの a2ensite より後にある', () => {
    // コメント行は対象外にする(説明文中の "apache2 -t" の言及を実装と数えない)。
    const finalStage = dockerfile
      .slice(dockerfile.lastIndexOf('\nFROM '))
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
    const ensiteAt = finalStage.indexOf('a2ensite');
    const certAt = finalStage.indexOf('openssl req');
    const testAt = finalStage.indexOf('apache2 -t', ensiteAt);
    expect(ensiteAt).toBeGreaterThanOrEqual(0);
    expect(certAt, '最終ステージの a2ensite より後に証明書生成が無い').toBeGreaterThan(ensiteAt);
    expect(testAt, '最終ステージの a2ensite より後に apache2 -t が無い').toBeGreaterThan(certAt);
  });

  it('entrypoint の証明書生成は、存在チェック付きの予備のままである', () => {
    expect(entrypoint).toContain('if [ ! -f "$TLS_DIR/nekoroot.crt" ]');
  });
});
