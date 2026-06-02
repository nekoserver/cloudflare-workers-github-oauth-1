# SPEC: AIチャット過去ログ スワイプ削除

**対象**: `src/views/aichat.ts` のサイドバー結果リスト描画（`renderSidebarResults` / `addSwipeBehavior`）、
`src/index.ts` の `DELETE /api/aichat/shares/:id` エンドポイント、
D1 `ai_chat_shares.deleted_at` カラム
— サイドバーの過去ログ項目を左スワイプすることで「削除」ボタンを露出し、
確認ダイアログ承認後に論理削除（`deleted_at` セット）を行い、一覧からフェードアウトで消去する。

---

## 背景

- AIチャット画面の左サイドバーに過去ログが一覧表示されるが、削除手段が存在しなかった
- モバイルでよく見られる左スワイプ → 削除ボタン露出 → 確認 → 消去 のパターンを採用

---

## DBスキーマ変更

### マイグレーション SQL

```sql
ALTER TABLE ai_chat_shares ADD COLUMN deleted_at TEXT;
```

### カラム定義

| テーブル | カラム | 型 | 説明 |
|---|---|---|---|
| `ai_chat_shares` | `deleted_at` | `TEXT` (nullable) | 論理削除日時（ISO 8601）。NULL = 未削除 |

---

## API

### `DELETE /api/aichat/shares/:id`

**認証**: 必須（authMiddleware）

**処理フロー**:
1. `id` と `user_id`（認証ユーザー）で `ai_chat_shares` を検索
2. 見つからない、または `deleted_at IS NOT NULL` の場合 → `404`
3. `deleted_at = datetime('now')` をセット → `{ ok: true }` を返す

**エラーレスポンス**:

| HTTP ステータス | 内容 |
|---|---|
| `404` | 対象レコードが存在しない、または他ユーザーのレコード |
| `503` | DB未設定 |

### 既存エンドポイントへの影響

論理削除されたレコードは以下の全クエリから除外される（`AND deleted_at IS NULL` を追加）:

| エンドポイント | 変更箇所 |
|---|---|
| `GET /api/aichat/shares/search` | WHERE 句に `deleted_at IS NULL` 追加 |
| `GET /api/aichat/shares/calendar` | WHERE 句に `deleted_at IS NULL` 追加 |
| `GET /api/aichat/shares/by-date` | WHERE 句に `deleted_at IS NULL` 追加 |
| `GET /s/:userHash/:shareToken` | WHERE 句に `deleted_at IS NULL` 追加（削除済み共有リンクは 404 を返す） |

---

## フロントエンド

### HTML 構造変更（`renderSidebarResults`）

スワイプ対応のため、各サイドバー項目を以下の構造に変更:

```
.sidebar-result-item          ← position: relative; overflow: hidden
  .result-delete-btn          ← 削除ボタン（絶対配置、右端、z-index: 0）
  .result-swipe-inner         ← 既存コンテンツ（z-index: 1、左右スライド可能）
    .result-num
    .result-body
      .result-q
      .result-meta
```

`.result-swipe-inner` が `translateX(0)` の状態では `.result-delete-btn` は隠れている。
左スワイプで `translateX(-72px)` になると幅 72px の削除ボタンが露出する。

### スワイプ動作（`addSwipeBehavior`）

| 変数 | 値 | 説明 |
|---|---|---|
| `BTN_W` | `72px` | 削除ボタンの幅 |
| `THRESHOLD` | `50px` | スワイプ認識の最小距離 |

**タッチ操作（touchstart / touchmove / touchend）とマウス操作（mousedown / mousemove / mouseup）の両方に対応。**

動作フロー:

```
touchstart / mousedown
  → startX を記録

touchmove / mousemove
  → deltaX に応じて inner を translateX（0 〜 -72px の範囲）
  → transition: none（ドラッグ中はアニメーション無効）

touchend / mouseup
  → |deltaX| > THRESHOLD かつ 左方向 → スワイプ確定（inner を -72px に固定）
  → 上記以外 → スナップバック（inner を 0 に戻す）
```

別の項目をスワイプ開始した場合、既に開いている項目は自動的に閉じる（`closeSwipeOpen`）。

### 確認ダイアログ（`deleteConfirmOverlay`）

削除ボタンタップ時に表示されるカスタムモーダル。

| 要素 | ID | 役割 |
|---|---|---|
| オーバーレイ | `deleteConfirmOverlay` | 背景クリックでキャンセル |
| 確定ボタン | `deleteConfirmOk` | DELETE API 呼び出し → アニメーション削除 |
| キャンセルボタン | `deleteConfirmCancel` | ダイアログ閉じる＋スワイプを元に戻す |

キャンセル時は `result-swipe-inner` を `translateX(0)` に戻し `swipe-open` クラスを除去する。

### 削除アニメーション（`animateDeleteItem`）

1. `opacity: 0`（250ms フェードアウト）
2. 250ms 後: `height: 0` + `border-bottom-width: 0`（300ms 高さ収縮）
3. 550ms 後: DOM から要素を除去し `currentResults` から該当 ID を除外
4. 番号表示（`.result-num`）を再採番

### 状態管理変数

| 変数 | 型 | 説明 |
|---|---|---|
| `swipeOpenItem` | `Element \| null` | 現在スワイプ開放中の `.sidebar-result-item` |
| `swipeOpenInner` | `Element \| null` | 現在スワイプ開放中の `.result-swipe-inner` |
| `pendingDeleteId` | `string \| null` | 確認ダイアログ表示中の削除対象 ID |
| `pendingDeleteItem` | `Element \| null` | 確認ダイアログ表示中の `.sidebar-result-item` |

---

## CSS クラス一覧

| クラス | 説明 |
|---|---|
| `.sidebar-result-item` | 外側コンテナ（`position: relative; overflow: hidden`） |
| `.result-swipe-inner` | スライドするコンテンツ領域（`z-index: 1`） |
| `.result-delete-btn` | 削除ボタン（`position: absolute; right: 0; width: 72px; background: #e53e3e`） |
| `.sidebar-result-item.swipe-open` | スワイプ開放状態マーカー |
| `.delete-confirm-overlay` | 確認ダイアログの背景（`display: none` → `.open` で `flex`） |
| `.delete-confirm-box` | ダイアログ本体 |

---

## 注意事項

- 削除は**論理削除**であり、物理削除は行わない。`deleted_at` に日時がセットされるのみ
- 共有リンク（`/s/:userHash/:shareToken`）にアクセスした場合、論理削除済みであれば 404 を返す
- 物理削除が必要な場合は D1 コンソールから直接 SQL を実行すること:
  ```sql
  DELETE FROM ai_chat_shares WHERE deleted_at IS NOT NULL;
  ```
- スワイプ中は `transition: none` でアニメーションを無効化し、`touchend` / `mouseup` 後に `transition: transform 0.2s ease` を復元する

---

## 関連コミット

| コミットハッシュ | メッセージ |
|---|---|
| [`4afe646`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/4afe646) | AIチャット過去ログのスワイプ削除機能を追加 |
