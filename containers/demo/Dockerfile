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
# 2026-10-17: 以前は下記をRUN 1つにまとめており1.9GBの単一レイヤーになっていた。
# 本番ビルドでregistry.cloudflare.comへのレイヤーアップロードが
# "net/http: timeout awaiting response headers" で失敗していたため、
# レイヤーを分割して1回のアップロードを小さくする(scripts/check-cf-containers.shで
# 1レイヤーの上限を検証している)。
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        ca-certificates nodejs npm tmux gnupg \
        apache2 openssl openssh-server nftables curl \
        iproute2 iputils-ping net-tools dnsutils traceroute \
        netcat-openbsd tcpdump mtr-tiny whois procps xz-utils git gh locales \
    && rm -rf /var/lib/apt/lists/*
# 日本語: SSHのシェル・tmuxで日本語を入力・表示できるようにja_JP.UTF-8を生成し、
# ログインシェル(/etc/profile.d)とsshd経由のセッション(/etc/default/locale)の両方で既定にする。
RUN locale-gen ja_JP.UTF-8 \
    && printf 'LANG=ja_JP.UTF-8\n' > /etc/default/locale \
    && printf 'export LANG=ja_JP.UTF-8\n' > /etc/profile.d/locale.sh
ENV LANG=ja_JP.UTF-8
RUN apt-get update && apt-get install -y --no-install-recommends docker.io \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors --output /tmp/cloudflared.deb \
        https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
    && dpkg -i /tmp/cloudflared.deb \
    && rm -f /tmp/cloudflared.deb
RUN (curl -fsSL --retry 5 --retry-delay 3 https://tailscale.com/install.sh | sh || echo "WARN: tailscale install failed") \
    && rm -rf /var/lib/apt/lists/*
# Codex CLIは構成上必須。失敗を握りつぶさずビルドを失敗させる
# (2026-10-17: WARNで続行していたためClaude CLIが入っていないイメージが通っていた)。
RUN npm config set fetch-retries 5 && npm config set fetch-retry-mintimeout 10000 \
    && npm install -g @openai/codex \
    && command -v codex \
    && npm cache clean --force
# Claude CLI: 2026-10-17に一度外したが利用者希望で再追加。Node 22以上が必要なため、
# システムのnode(18、server.js・Codex用)とは別にnodejs.orgのNode 22を/opt/node22へ置き、
# そのnpmで入れる。claude.ai/install.shはこのセッションのサンドボックスから403で検証できないため使わない。
RUN curl -fsSL --retry 5 --retry-delay 3 --retry-all-errors -o /tmp/node22.tar.xz \
        https://nodejs.org/dist/v22.20.0/node-v22.20.0-linux-x64.tar.xz \
    && mkdir -p /opt/node22 && tar -xJf /tmp/node22.tar.xz -C /opt/node22 --strip-components=1 \
    && rm -f /tmp/node22.tar.xz
RUN /opt/node22/bin/npm install -g @anthropic-ai/claude-code \
    && ln -sf /opt/node22/bin/claude /usr/local/bin/claude \
    && claude --version \
    && /opt/node22/bin/npm cache clean --force
# wrangler: Node 20以上が必要なためClaude CLIと同じ/opt/node22のnpmで入れる。
# npmも起動スクリプトも`env node`でPATH上のnode 18を拾うため、PATHの先頭に/opt/node22/binを置く。
RUN PATH=/opt/node22/bin:$PATH npm install -g wrangler \
    && printf '#!/bin/sh\nPATH=/opt/node22/bin:$PATH exec /opt/node22/bin/wrangler "$@"\n' > /usr/local/bin/wrangler \
    && chmod +x /usr/local/bin/wrangler \
    && wrangler --version \
    && PATH=/opt/node22/bin:$PATH npm cache clean --force

# 2026-10-16(続き2): Codex CLI・Claude CLIを再度追加(利用者希望)。
# npm install -gはこのサンドボックスの outbound HTTPS プロキシが
# registry.npmjs.orgにSELF_SIGNED_CERT_IN_CHAINを返すため、このセッション
# では検証できない。Cloudflare Workers Buildの実ビルド環境は通常の
# インターネット接続を持つはずなので、実際のCI結果で成否を確認する
# (失敗した場合はこの行を再び削除する)。

WORKDIR /app
COPY server.js ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY cf /usr/local/bin/cf
COPY apache-demo.conf /etc/apache2/sites-available/000-demo.conf
COPY cloudflared-ingress.yml.template /etc/cloudflared/ingress.yml.template
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/cf \
    && a2enmod ssl proxy proxy_http proxy_wstunnel rewrite \
    && a2dissite 000-default \
    && a2ensite 000-demo \
    && mkdir -p /run/sshd

EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]
