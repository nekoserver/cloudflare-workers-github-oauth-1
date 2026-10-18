# /cf-containersページ(Cloudflare Containersのデモ用管理ページ)が
# 起動・停止・プロキシ対象にする最小限のコンテナイメージ。
# server.js自体はNode標準モジュールのみに依存する(ビルド時間・
# イメージサイズを抑える)。
#
# ユーザー要望(2026-10-16)によりCodex CLI(@openai/codex)・Claude CLI
# (@anthropic-ai/claude-code)をイメージに同梱する。現時点ではこれらを
# ブラウザから操作するためのWeb化(ターミナルUI等)は未実装(「あとから
# でいい」との回答)で、コンテナ内に実行ファイルがあるだけの状態。
# 利用にはOPENAI_API_KEY(Codex CLI用)・ANTHROPIC_API_KEY(Claude CLI用、
# 未設定の場合はClaude CLI側の対話ログインが必要)をコンテナ起動時の
# 環境変数として渡す(src/containers/demoContainer.tsのenvVars参照)。
# どちらもAPI呼び出し自体に課金が発生する。
FROM node:22-alpine

RUN apk add --no-cache ca-certificates docker-cli github-cli rclone

ARG CODEX_VERSION=0.163.0
ARG CLAUDE_VERSION=2.1.302
ARG WRANGLER_VERSION=4.151.1
RUN npm install -g \
      "@openai/codex@${CODEX_VERSION}" \
      "@anthropic-ai/claude-code@${CLAUDE_VERSION}" \
      "wrangler@${WRANGLER_VERSION}" \
    && codex --version \
    && docker --version \
    && gh --version \
    && rclone version \
    && wrangler --version

WORKDIR /app
COPY server.js ./
COPY entrypoint.sh /usr/local/bin/container-entrypoint
COPY cf /usr/local/bin/cf
RUN chmod +x /usr/local/bin/container-entrypoint /usr/local/bin/cf \
    && cf \
    && mkdir -p /workspace

EXPOSE 8080
ENV PORT=8080
ENV HOME=/workspace
ENV CODEX_HOME=/workspace/.codex
ENV GH_CONFIG_DIR=/workspace/.config/gh

ENTRYPOINT ["/usr/local/bin/container-entrypoint"]
CMD ["node", "server.js"]
