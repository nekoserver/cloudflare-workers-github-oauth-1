# NOTICE.cloudflare-workers-github-oauth-1.20260913

## jsdom環境ではJWTのArrayBufferをそのままSubtleCrypto.verifyに渡せない

**対象**: `src/utils/jwt.ts` の `verifyJWT`、`// @vitest-environment jsdom` を付けた
ルートテスト(`cheese-search-page` / `wasm-modules-page` など)

vitestのjsdom環境では、`Uint8Array.buffer` で得た `ArrayBuffer` のrealmが
Nodeの `crypto.subtle.verify` と一致しない。第3引数にraw ArrayBufferを渡すと

```text
TypeError: Failed to execute 'verify' on 'SubtleCrypto':
3rd argument is not instance of ArrayBuffer, Buffer, TypedArray, or DataView
```

になり、`verifyJWT` がcatchして `null` を返す。その結果、認証済みの
`app.request` が毎回401になる。TypedArray(`new Uint8Array(signature)`)を渡せば
Workers本番とjsdomテストの両方で通る。

「ページ実装が壊れた」と決めつける前に、同じファイルの他テストが
`getXxxPage()` 直呼びで通っているなら、JWTのrealm問題を疑うこと。

## ソース文字列照合テストは実装のリファクタで毎回落ちる

**対象**: `index.ts` や巨大HTMLテンプレートを `indexOf` + 固定長 `slice` で切って
特定の1行を探すテスト

`app.post('/api/aichat'` から9200文字、`app.get('/api/aichat/shares/search'` から
900文字、のように窓を固定すると、手前にコメントや分岐が増えた瞬間に
実装は正しいのにテストだけ落ちる。探すなら該当行そのものの `indexOf` を使うか、
純粋関数に切り出して入出力で検証すること。
