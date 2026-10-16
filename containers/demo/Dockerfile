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

RUN npm install -g @openai/codex @anthropic-ai/claude-code

WORKDIR /app
COPY server.js ./

EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]
