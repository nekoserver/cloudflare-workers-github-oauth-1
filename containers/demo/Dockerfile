# /cf-containersページ(Cloudflare Containersのデモ用管理ページ)が
# 起動・停止・プロキシ対象にする最小限のコンテナイメージ。
# server.js自体はNode標準モジュールのみに依存する(ビルド時間・
# イメージサイズを抑える)。
#
# 2026-10-16: Codex CLI・Claude CLIをイメージにnpm install -gで同梱する
# 変更を一度入れたが、Cloudflare Workers Buildのビルド環境・このセッション
# のサンドボックスの両方でnpmレジストリへのTLS接続がSELF_SIGNED_CERT_IN_CHAIN
# で失敗することをwrangler deploy --dry-runのローカルDockerビルドで確認した
# (このサンドボックス固有の問題ではなく、実際のCI(Workers Builds)でも
# ビルド失敗の原因になっていた)。さらにClaude/Codex CLIの実行自体は
# SSH(wrangler containers ssh)で入ってから利用者自身が設定する方針に
# 変更されたため、イメージへの事前インストールは撤回した。
# ベースをUbuntu(利用者が使い慣れているディストリビューション)へ変更。
# node:*系の公式イメージ(Debian/Alpine派生)ではなく、Ubuntu公式イメージへ
# apt-getでNode.jsを導入する構成にしている。glibcベースのため、今後
# cloudflared等のCloudflare公式配布バイナリを追加する際のmusl libc互換性
# 問題も避けられる。
#
# tmux: SSH(wrangler containers ssh)で入った後、接続が切れても作業(Codex/
# Claude CLI等のセッション)を継続できるようにするターミナルマルチプレクサ。
#
# Node.js: NodeSource経由での最新版導入を試みたが、deb.nodesource.comへの
# 到達性をこのセッションのサンドボックスでは確認できなかった(Cloudflare
# Workers Build側での到達性は未確認)。実際のCI失敗の原因はこのDockerfile
# ではなくDurable Objectのmigration(wrangler versions upload非対応)だと
# 判明した後も、外部依存を減らす目的でUbuntu標準リポジトリのnodejsパッケージ
# に戻したままにしている。18.x系とやや古いが、server.js自体はNode標準
# モジュールのみに依存し要求するAPIも軽量なため、動作に支障はない。
#
# 2026-10-16(続き): nekorootという名前のCloudflare Tunnel(cloudflared)で
# Apache(自己署名TLS)とSSH(22番)を外部公開する構成を追加。Caddyは後回しの
# 指示のため導入しない(cloudflared→Apacheを直接つなぐ)。ファイアウォールは
# INドロップ+ESTABLISHED,RELATEDのみ許可(nftables、コンテナは
# Firecracker microVMで自分専用のnetnsを持つためroot相当の権限でも意味を
#持つ、2026-10-16のCloudflare Containers公式ドキュメント調査で確認済み)。
# ホスト名・トンネルトークンはビルド時に埋め込まず、起動時に
# NEKOROOT_HOSTNAME・NEKOROOT_TUNNEL_TOKEN環境変数(envVars経由、
# src/containers/demoContainer.ts参照)から受け取る。
# tailscaled: Railway VM側と同じTailscale経由のアクセス手段を揃えるため
# 追加。Cloudflare Containersが/dev/net/tunを渡すかはこのセッションでは
# 未確認のため、tailscaled起動時は`--tun=userspace-networking`(TUNデバイス
# 不要なユーザー空間ネットワーキングモード)で起動する前提にしている
# (entrypoint.sh参照)。認証キーはTAILSCALE_AUTHKEY環境変数(envVars経由)
# で渡す想定、未設定ならtailscaled起動をスキップする。
FROM ubuntu:24.04
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        ca-certificates nodejs tmux gnupg \
        apache2 openssl openssh-server nftables curl \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL --output /tmp/cloudflared.deb \
        https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    && dpkg -i /tmp/cloudflared.deb \
    && rm -f /tmp/cloudflared.deb \
    && curl -fsSL https://tailscale.com/install.sh | sh \
    && npm install -g @openai/codex @anthropic-ai/claude-code

# 2026-10-16(続き2): Codex CLI・Claude CLIを再度追加(利用者希望)。
# npm install -gはこのサンドボックスの outbound HTTPS プロキシが
# registry.npmjs.orgにSELF_SIGNED_CERT_IN_CHAINを返すため、このセッション
# では検証できない。Cloudflare Workers Buildの実ビルド環境は通常の
# インターネット接続を持つはずなので、実際のCI結果で成否を確認する
# (失敗した場合はこの行を再び削除する)。

WORKDIR /app
COPY server.js ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY apache-demo.conf /etc/apache2/sites-available/000-demo.conf
COPY cloudflared-ingress.yml.template /etc/cloudflared/ingress.yml.template
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && a2enmod ssl proxy proxy_http proxy_wstunnel rewrite \
    && a2dissite 000-default \
    && a2ensite 000-demo \
    && mkdir -p /run/sshd

EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
