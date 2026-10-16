# /cf-containersページ(Cloudflare Containersのデモ用管理ページ)が
# 起動・停止・プロキシ対象にする最小限のコンテナイメージ。
# 外部パッケージへの依存なし(Node標準モジュールのみ)で、ビルド時間・
# イメージサイズを抑える。
FROM node:22-alpine

WORKDIR /app
COPY server.js ./

EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]
