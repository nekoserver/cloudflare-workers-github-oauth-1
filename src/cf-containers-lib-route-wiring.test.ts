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
// 同じ日、Apache 本体が起動していない真因も判明した: entrypoint の apache2ctl の start が、
// systemd が居るとの判定で systemctl へ委譲され、systemctl は chroot 環境で start を無視して
// 正常終了する(実機の /tmp/apache.log で確認)。設定・配置・証明書が全て正しくても Apache だけが
// 上がらず、終了コードが正常なため WARN も出ない。起動方法も前提チェックで固定する
// (SPEC.cloudflare-workers-github-oauth-1.lib-apache-wiring の REQ-LW-011)。

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

  it('lib の VirtualHost は応答に charset=utf-8 を付ける(断片単体の表示でも文字化けさせない)', () => {
    expect(libConf).toMatch(/AddDefaultCharset\s+utf-8/i);
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

describe('前提チェック: ダッシュボードのパネルの Apache 側前提(REQ-PN-006)', () => {
  // SPEC.lib.dashboard-state.shtml 版2。Cookie の表示選択を SSI の #if で使うため、
  // lib の VirtualHost で環境変数へ写し、lib の Directory で旧式パーサを有効にする。
  // 旧式パーサでないと SetEnvIf の変数を #if から参照できない(実測済み、SPEC の前提 P8)。
  it('LIBDASH_OFF の既定と Cookie からの上書き、LIBDASH_LAYOUT の SetEnvIf がある', () => {
    expect(libConf).toMatch(/SetEnvIf\s+Request_URI\s+"[^"]*"\s+LIBDASH_OFF=","/);
    expect(libConf).toMatch(/SetEnvIf\s+Cookie\s+"libdash_off=\(\[\^;\]\*\)"\s+LIBDASH_OFF=\$1/);
    expect(libConf).toMatch(/SetEnvIf\s+Cookie\s+"libdash_layout=\(\[\^;\]\*\)"\s+LIBDASH_LAYOUT=\$1/);
  });

  it('lib の Directory に SSILegacyExprParser On がある', () => {
    const dirAt = libConf.indexOf('<Directory /var/www/html/lib>');
    expect(dirAt, 'apache-lib.conf に lib の Directory が無い').toBeGreaterThanOrEqual(0);
    const dirBlock = libConf.slice(dirAt, libConf.indexOf('</Directory>', dirAt));
    expect(dirBlock).toMatch(/^\s*SSILegacyExprParser\s+On\s*$/m);
  });
});

// 経緯: フラグ MUSE_TAILNET_HEALTH_OK は lib vhost の SetEnvIf が X-Forwarded-User を
// 正規ユーザー名と照合して立てる。2026-11-18 夜、稼働中インスタンスの /etc/apache2 へ
// 実名の行をその場で挿入して開通したが、インスタンス内の変更は再作成で消えるため、
// 2026-11-19 の再作成で再び (access denied) に戻った(利用者報告)。
// 行の置き場所はイメージ側の apache-lib.conf でなければならない(版4、REQ-TH-014)。
// 判定はフラグを立てる SetEnvIf の行だけを対象にする(コメント中の言及では判定しない)。
// 復旧の経緯(2026-11-19): この前提チェックと conf の行は #2663 で入ったが、
// 基点の古い全体ファイル push を含む後続 PR(#2664 のテスト側、#2665 の conf 側)で
// それぞれ消え、ガードが緑のまま行が欠落した。本 describe はその再発防止を兼ねる。
describe('前提チェック: tailnet ヘルス表示のフラグ恒常化(REQ-TH-014)', () => {
  it('lib の VirtualHost に、X-Forwarded-User を実名で照合して MUSE_TAILNET_HEALTH_OK を立てる SetEnvIf がある', () => {
    const lines = libConf.split('\n')
      .map((l) => l.trim())
      .filter((t) => t.startsWith('SetEnvIf') && t.includes('MUSE_TAILNET_HEALTH_OK=1'));
    expect(lines.length, 'apache-lib.conf に MUSE_TAILNET_HEALTH_OK を立てる SetEnvIf が無い').toBeGreaterThanOrEqual(1);
    expect(lines[0]).toMatch(/^SetEnvIf\s+X-Forwarded-User\s+\^nekoserver\$\s+MUSE_TAILNET_HEALTH_OK=1$/);
  });
});

describe('前提チェック: 実行経路の BASE 共有の Apache 側前提(REQ-EP-034)', () => {
  // SPEC.lib.muse.execution-path 版3。CGI(www-data)と承認(root)ではホームが分かれ、
  // 状態の置き場所が実行ユーザーのホーム依存だと受付と承認が噛み合わない
  // (2026-11-19 実測: 受付が /var/www 配下を作れず 500)。配信側が CGI の環境へ
  // 置き場所と運用ホームを明示して渡し、実体は entrypoint が用意する。
  it('lib の VirtualHost に MUSE_SDK_BASE と MUSE_SDK_HOME の SetEnv がある', () => {
    expect(libConf).toMatch(/^\s*SetEnv\s+MUSE_SDK_BASE\s+\/var\/lib\/muse-sdk\s*$/m);
    expect(libConf).toMatch(/^\s*SetEnv\s+MUSE_SDK_HOME\s+\/root\s*$/m);
  });

  it('entrypoint が BASE の実体と既定ワークスペースを用意する', () => {
    expect(entrypoint).toMatch(/mkdir -p \/var\/lib\/muse-sdk\b/);
    expect(entrypoint).toMatch(/chown www-data:www-data \/var\/lib\/muse-sdk\b/);
    expect(entrypoint).toMatch(/mkdir -p \/root\/sdk-ask-workspace\b/);
  });
});

describe('前提チェック: entrypoint の Apache 起動方法(REQ-LW-011)', () => {
  it('apache2ctl のサービス制御(start・stop・restart 等)を使わない', () => {
    expect(entrypoint).not.toMatch(/apache2ctl\s+(start|stop|restart|graceful)/);
  });

  it('envvars を読み込んでから httpd 本体を直接起動する', () => {
    const envvarsAt = entrypoint.search(/(?:\.|source)\s+\/etc\/apache2\/envvars\b/);
    const startAt = entrypoint.indexOf('/usr/sbin/apache2 -k start');
    expect(envvarsAt, 'entrypoint に /etc/apache2/envvars の読み込みが無い').toBeGreaterThanOrEqual(0);
    expect(startAt, 'entrypoint に /usr/sbin/apache2 -k start が無い').toBeGreaterThanOrEqual(0);
    expect(startAt).toBeGreaterThan(envvarsAt);
  });

  it('起動後に両ポートの待ち受けを確認し、確認できない場合は失敗を明示する', () => {
    const libPort = serverJs.match(/const LIB_PORT = (\d+);/)![1];
    const demoPort = demoConf.match(/^Listen (\d+)$/m)![1];
    const startAt = entrypoint.indexOf('/usr/sbin/apache2 -k start');
    expect(startAt, 'entrypoint に /usr/sbin/apache2 -k start が無い').toBeGreaterThanOrEqual(0);
    const after = entrypoint.slice(startAt);
    expect(after, '起動後に demo 側ポートの待ち受け確認が無い').toContain(`/dev/tcp/127.0.0.1/${demoPort}`);
    expect(after, '起動後に lib 専用ポートの待ち受け確認が無い').toContain(`/dev/tcp/127.0.0.1/${libPort}`);
    expect(after, '待ち受けを確認できない場合の WARN が無い').toMatch(/WARN: apache2/);
  });
});
