# HTTP QUERY メソッドのサンプル

HTTP QUERY メソッド([IETF draft-ietf-httpbis-safe-method-w-body](https://www.ietf.org/archive/id/draft-ietf-httpbis-safe-method-w-body-11.html))を
使った検索APIのサンプル。QUERY は **GET と同じ safe(副作用なし) / idempotent
(何度実行しても結果が変わらない)** セマンティクスを持ちながら、URLに載せづらい
複雑な検索条件をリクエストボディで送れる。「本来は読み取り専用なのに POST を
借用している」検索APIの代替になる。

## ファイル構成

- `server.ts` — Hono の `app.on('QUERY', ...)` で実装した書籍検索API
- `server.test.ts` — vitest によるテスト(`Hono#request()`でQUERY+ボディが実際に動くことを検証済み)
- `openapi.yaml` — OpenAPI 3.2 形式のAPI定義(Path Item Objectのネイティブ `query` フィールドを使用)

## 動かし方

```bash
npx vitest run examples/http-query-method/server.test.ts
```

## curlでの動作確認例

QUERY メソッドはブラウザの `fetch()` や `curl` からも送信できる(GET/HEAD以外は
ボディ付き任意メソッドが許可されているため)。

```bash
curl -X QUERY http://localhost:8787/books \
  -H "Content-Type: application/json" \
  -d '{"genre":"sci-fi","minYear":1930,"maxYear":1970,"sort":"year"}'
```

```json
{"count":2,"books":[{"id":4,"title":"1984","genre":"sci-fi","year":1949},{"id":3,"title":"ソラリス","genre":"sci-fi","year":1961}]}
```

ボディを省略すると全件を返す(GETと同じ安全な読み取り操作):

```bash
curl -X QUERY http://localhost:8787/books
```

## OpenAPI 3.2 での書き方

OpenAPI 3.2 は Path Item Object に `get`/`post` などと同格の `query` フィールドを
ネイティブに追加した。3.2 未対応のツール向けには `additionalOperations` による
代替記法も `openapi.yaml` 末尾にコメントで残してある。
