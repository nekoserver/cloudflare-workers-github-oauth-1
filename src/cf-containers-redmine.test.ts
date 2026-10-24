import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');
const entrypoint = readFileSync('containers/demo/entrypoint.sh', 'utf8');
const redmineConf = readFileSync('containers/demo/apache-redmine.conf', 'utf8');
const serverJs = readFileSync('containers/demo/server.js', 'utf8');
const redmineDump = readFileSync('containers/demo/redmine-dump', 'utf8');

describe('demoコンテナ: minitest-mock・Passenger・Redmineの追加', () => {
  it('minitest-mockを最新版でgem installする', () => {
    expect(dockerfile).toMatch(/^ARG MINITEST_MOCK_VERSION=5\.27\.0$/m);
    expect(dockerfile).toContain('gem install minitest-mock -v "${MINITEST_MOCK_VERSION}"');
  });
  it('Passengerを最新版でgem installし、Apacheモジュールをビルドする', () => {
    expect(dockerfile).toMatch(/^ARG PASSENGER_VERSION=6\.2\.1$/m);
    expect(dockerfile).toContain('gem install passenger -v "${PASSENGER_VERSION}"');
    expect(dockerfile).toContain('passenger-install-apache2-module --auto --languages ruby');
    expect(dockerfile).toContain('passenger-install-apache2-module --snippet > /etc/apache2/mods-available/passenger.load');
    expect(dockerfile).toContain('a2enmod ssl proxy proxy_http proxy_wstunnel rewrite cgid include remoteip passenger');
  });
  it('Redmineを公式リポジトリのgitタグ(コミット固定)から取得する', () => {
    expect(dockerfile).toMatch(/^ARG REDMINE_VERSION=7\.0\.2$/m);
    expect(dockerfile).toMatch(/^ARG REDMINE_COMMIT=c1be3264e52d65f2870c05d30509520964c5580f$/m);
    expect(dockerfile).toContain('FROM ubuntu:26.04 AS redmine-src');
    expect(dockerfile).toContain('git clone --depth 1 --branch "${REDMINE_VERSION}" https://github.com/redmine/redmine.git /src');
    expect(dockerfile).toContain('test "$(git -C /src rev-parse HEAD)" = "${REDMINE_COMMIT}"');
  });
  it('RedmineのGemfileがsqlite3アダプタを検出できるよう、bundle installの前にdatabase.ymlを置く', () => {
    const i1 = dockerfile.indexOf("config/database.yml");
    const i2 = dockerfile.indexOf('bundle install --jobs');
    expect(i1).toBeGreaterThan(-1);
    expect(i2).toBeGreaterThan(i1);
    expect(dockerfile).toContain('adapter: sqlite3');
  });
  it('Redmineのファイルはwww-data所有にする(Passengerのユーザー切り替え用)', () => {
    expect(dockerfile).toContain('chown -R www-data:www-data /opt/redmine');
  });
  it('Redmineは127.0.0.1限定のVirtualHostで、外部公開の8443側には置かない', () => {
    expect(redmineConf).toContain('Listen 127.0.0.1:8444');
    expect(redmineConf).toContain('<VirtualHost 127.0.0.1:8444>');
    expect(redmineConf).not.toMatch(/Listen 8444\b/); // 0.0.0.0側で待ち受けない
    const demoConf = readFileSync('containers/demo/apache-demo.conf', 'utf8');
    expect(demoConf).not.toContain('redmine');
  });
  it('entrypoint.shが起動時にRedmineのDBマイグレーションを実行する', () => {
    expect(entrypoint).toContain('/opt/redmine/storage/redmine.sqlite3');
    expect(entrypoint).toContain("su -s /bin/sh www-data -c");
    expect(entrypoint).toContain('bundle exec rake db:migrate');
  });
  it('server.jsが/redmineを127.0.0.1:8444へ内部プロキシし、prefixを剥いで転送する', () => {
    expect(serverJs).toContain("const REDMINE_PREFIX = '/redmine'");
    expect(serverJs).toContain("host: '127.0.0.1', port: 8444");
    expect(serverJs).toContain('req.url.slice(REDMINE_PREFIX.length)');
  });
  it('Rails側のリンク生成は外部から見た完全なパス(/cf-containers/proxy/redmine)に合わせる', () => {
    expect(dockerfile).toContain('ENV RAILS_RELATIVE_URL_ROOT=/cf-containers/proxy/redmine');
  });
  it('redmine-dumpコマンドでSQLite3のDBをダンプできる', () => {
    expect(redmineDump).toContain('sqlite3 "$DB" .dump');
    expect(dockerfile).toContain('COPY redmine-dump /usr/local/bin/redmine-dump');
  });
  it('HTTP経由でもダンプを取得できる(/debug/redmine-dump、認証済み管理プロキシ経由のみ到達可能)', () => {
    expect(serverJs).toContain("req.url === '/debug/redmine-dump'");
    expect(serverJs).toContain("runCmd('redmine-dump'");
  });
});
