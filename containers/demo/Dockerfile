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
FROM ubuntu:24.04
RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates nodejs tmux \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY server.js ./

EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]
