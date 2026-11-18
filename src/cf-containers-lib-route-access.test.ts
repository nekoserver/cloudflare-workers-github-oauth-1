import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// 起動時の lib の復元と、起動オプション LIB_ROUTE_ACCESS_CONTROL(ユーザー指定、2026-11-13)。
// libは管理者専用のまま、オプションが "1" のときだけ lib 側(nekoserver/lib の restore-claude-host.sh)が
// 経路ID(via)のある要求にチャットの経路を通す。lib はイメージに入れず、コンテナの /root/lib を起動時に使う。
const dc = readFileSync('src/containers/demoContainer.ts', 'utf8');
const ep = readFileSync('containers/demo/entrypoint.sh', 'utf8');
const toml = readFileSync('wrangler.toml', 'utf8');

describe('lib の起動時の復元と経路情報によるアクセス制御', () => {
  it('Workerの既存のシークレットと起動オプションを、同じ名前でコンテナへ渡す', () => {
    expect(dc).toContain("ORIGIN_HMAC_SECRET: env.ORIGIN_HMAC_SECRET ?? '',");
    expect(dc).toContain("MUSE_API_KEY: env.MUSE_API_KEY ?? '',");
    expect(dc).toContain("LIB_ROUTE_ACCESS_CONTROL: env.LIB_ROUTE_ACCESS_CONTROL ?? '',");
    expect(readFileSync('src/types.ts', 'utf8')).toMatch(/LIB_ROUTE_ACCESS_CONTROL\?: string;/);
  });

  it('起動オプションは wrangler.toml の [vars] に1つだけ置く', () => {
    const vars = toml.slice(toml.indexOf('[vars]'), toml.indexOf('\n[', toml.indexOf('[vars]') + 1));
    expect(vars.match(/^LIB_ROUTE_ACCESS_CONTROL = "(?:0|1)"$/gm)).toHaveLength(1);
  });

  it('entrypoint は Apache の起動の後、/root/lib が届くのを裏で待ってから lib の復元を呼び、失敗しても起動は続ける', () => {
    // 2026-11-18: /root/lib はコンテナの起動から約2時間後に置かれ、起動時に一度だけ見る作りでは復元もbind mountも行われなかった。
    const call = ep.indexOf('/usr/local/libexec/lib-restore-wait.sh /root/lib /var/www/html/lib');
    expect(call).toBeGreaterThan(ep.indexOf('mount --bind /root/lib /var/www/html/lib'));
    expect(call).toBeGreaterThan(ep.indexOf('# --- Apache'));
    expect(call).toBeLessThan(ep.lastIndexOf('exec "$@"'));
    const line = ep.slice(call, ep.indexOf('\n', call));
    expect(line).toBe('/usr/local/libexec/lib-restore-wait.sh /root/lib /var/www/html/lib 86400 30 /tmp/restore-claude-host.log &');
    // 秘密の値はコマンドラインに出さない(環境変数で引き継ぐ)。
    expect(line).not.toMatch(/\$\{?(ORIGIN_HMAC_SECRET|MUSE_API_KEY)/);
    // 起動時に一度だけ見て終わる旧い呼び方は残さない。
    expect(ep).not.toContain('if [ -x /root/lib/claude/ops/restore-claude-host.sh ]');
  });

  it('Dockerfile が待つスクリプトを実行できる形で置く', () => {
    const dockerfile = readFileSync('containers/demo/Dockerfile', 'utf8');
    expect(dockerfile).toContain('COPY lib-restore-wait.sh /usr/local/libexec/lib-restore-wait.sh');
    expect(dockerfile).toMatch(/chmod (?:\+x|755) [^\n]*\/usr\/local\/libexec\/lib-restore-wait\.sh/);
  });
});
