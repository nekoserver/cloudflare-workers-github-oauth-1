# NOTICE — UUID 実装に関する知見

日付: 2026-06-22

---

## 1. UUIDv7 を手動生成する場合は末尾グループのバイト数に注意

### 現象

`/uuid` ページで v7 または「v4+v7 を交互」モードで UUID を生成すると、D1 への保存件数が常に 0 になる。

### 原因

RFC 4122 / RFC 9562 の UUID 文字列形式は `8-4-4-4-12` （ハイフン区切りの16進文字数）。末尾グループは **6 バイト = 12 文字** 必要。

`uuidV7()` の実装で `new Uint8Array(10)` を生成し、先頭 5 バイト（b[0]〜b[4]）を ver・varB 等に消費した後 `b.slice(5)` = 5 バイト = **10 文字** を末尾グループに使っていた。

結果として生成される UUID が非標準形式になり、サーバー側の正規表現 `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i` にマッチせず全件バリデーションで弾かれ `{ saved: 0 }` が返った。

```
生成された v7 (バグあり):  xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx   ← 末尾10文字
UUID 正規形:               xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  ← 末尾12文字
```

### 修正

`new Uint8Array(10)` → `new Uint8Array(11)` に変更。`b.slice(5)` が 6 バイト = 12 文字になり正規形の UUID v7 が生成される。

関連 PR: [#742](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/742)

---

## 2. v4 と v7 で保存の成否が分かれる場合はバリデーションを疑え

### 現象

`POST /api/uuid/save` が `{ saved: 0 }` を緑文字で表示しつつ正常終了しているように見える。

### 理由

`saved: 0` は HTTP 200 で返るため、クライアントの `.catch` には入らず `setSaveStatus('D1保存: 0件', 'ok')` が呼ばれる。エラーではなく「バリデーション通過数がゼロ」という正常応答。

### 教訓

- `saved: 0` が返ったとき、テーブル未作成ではなくバリデーション（正規表現・バージョン文字列）で弾かれている可能性を先に確認する
- テーブルが存在しない場合は INSERT が例外を投げて 500 になるため、`saved: 0` とは区別できる
- v4（`crypto.randomUUID()` 使用）と v7（手動生成）で挙動が分かれるときは、手動生成側のフォーマットを疑う

---

## 3. /apis ページの curl サンプルに JWT を表示しない設計は正しい

`HttpOnly` Cookie に JWT を保存している場合、ページ上に JWT を表示すると XSS で即座に盗まれるリスクがある。`/apis` ページの curl 表示は `Cookie: auth_token=<JWT_TOKEN>` とプレースホルダーにとどめ、実値は DevTools → Application → Cookies で確認するフローが適切。

---

## 4. iframe の sandbox 属性と内部リンク遷移

`<iframe sandbox="allow-same-origin">` 内の `<a href="/settings">` はクリックしても画面遷移しない。`allow-same-origin` はオリジン扱いを変えるだけで、トップレベルへのナビゲーション権限は与えない。

ユーザー操作起点のリンク遷移を許可するには `allow-top-navigation-by-user-activation` を追加する。スクリプトやフォームは無効のまま維持される。

関連 PR: [#740](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/740)
