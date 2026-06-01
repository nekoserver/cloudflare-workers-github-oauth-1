# NOTICE 2026-06-01

## 非同期で innerHTML を二段階再生成する箇所では、全段階で DOM 要素の onclick を再設定しなければならない

**対象**: `src/views/repositories.ts` の `showKeywordDetail` 関数内 `kmlCountBadge` バッジの `onclick` 設定処理。同様のパターンを踏む実装全般。

### 事象

「現在分類中のカテゴリ数」バッジをタップしても KML モーダルが開かなくなった。
バッジをタップするとカウント表示が `(…)` に変わりその後 `(-/-)` になるか、
あるいは何も起きないかのどちらかになっていた。

### 原因

`showKeywordDetail` は DOM の生成を**2段階**で行っていた。

| 段階 | タイミング | 処理 |
|---|---|---|
| 1 | 即時（同期） | `keywordDetailPanel.innerHTML = '...'` でローディング状態のパネルを生成 |
| 2 | 非同期 | `keyword-stats` API のレスポンス受信後、`panel.innerHTML = '...'` で詳細データ込みのパネルに差し替え |

段階1の直後に `setupKmlBadge(query)` を呼んで `kmlCountBadge.onclick` を設定していたが、
段階2の再描画で `kmlCountBadge` 要素が**新たに作り直される**ため、段階1で設定した `onclick` は失われる。

段階2でも同名の関数 `kmlLoadAndBindBadge(query)` を呼んで `onclick` を再設定していたが、
リファクタリングで `kmlLoadAndBindBadge` を `setupKmlBadge` に置き換えた際に
**段階1の呼び出し箇所しか更新せず、段階2の呼び出し（6418行）を見落とした**。

結果として段階2の完了後は `kmlCountBadge` に `onclick` が存在しない状態になり、
バッジタップが無反応または API エラー表示のみになった。

### 修正

`setupKmlBadge(q)` を名前付き関数として定義し、段階1・段階2の**両方**から呼び出す形に統一した。

```
// 段階1（即時）
keywordDetailPanel.innerHTML = '...'; // kmlCountBadge 生成
...
setupKmlBadge(query);  // ← ここで onclick を設定

// 段階2（非同期 / keyword-stats 完了後）
panel.innerHTML = '...';  // kmlCountBadge が新規作成される
...
setupKmlBadge(query);  // ← ここでも onclick を再設定（必須）
```

### 再発防止ルール

1. **innerHTML を非同期コールバック内で再生成する場合、その中に `id` を持つ要素がいれば、直後に必ずイベントハンドラを再バインドすること。**
   - 「初回描画でバインドしたから大丈夫」は誤り。再描画のたびに DOM 要素は別インスタンスになる。

2. **DOM 要素への `onclick` / `addEventListener` を設定するコードをリファクタリングする際は、同じ要素 id に対してバインドしている箇所をリポジトリ全体で `grep` してから着手すること。**
   - 対象の grep コマンド例: `grep -n "getElementById('kmlCountBadge')\|kmlLoadAndBindBadge" src/views/repositories.ts`

3. **段階的描画を行う関数を書くときは、各段階のセットアップ責務（イベントバインド・初期化処理）を一覧できるようにコメントで明示すること。**
   ```
   // --- 段階1: 即時描画 ---
   // --- 段階2: keyword-stats 完了後に再描画 ---
   ```

### 関連コミット

- [`6382c0a`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/6382c0a) — PR #422: バッジ初期設定のリファクタリング（この変更でバグ混入）
- [`3bb8b8b`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/3bb8b8b) — 修正: keyword-stats取得後のパネル再描画でkmlCountBadgeのonclickが消える問題
