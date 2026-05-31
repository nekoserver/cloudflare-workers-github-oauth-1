# NOTICE: keyword_category_groups 実装の知見

**対象セッション**: 2026-05-31
**関連PR**: #367, #368, #369, #370, #371
**関連ブランチ**: `fix/keyword-classify-zero-hits`

---

## 1. migration 未実行テーブルへの INSERT は「no such table」で静かに失敗する

### 現象
`keyword_category_groups` テーブルに INSERT しようとしたとき、migration 0037 が未実行の場合に「グループの登録に失敗しました」と表示されるだけで原因が一切わからなかった。

### 原因
```
SQLite エラー: no such table: keyword_category_groups
```
このエラーメッセージは UNIQUE 違反チェック（`msg.includes('UNIQUE')`）に引っかからず、汎用エラーに落ちていた。

### 対処パターン
INSERT が "no such table" / "SQLITE_ERROR" で失敗した場合は `CREATE TABLE IF NOT EXISTS` を実行してリトライする自己修復パターンを採用した。

```typescript
const doInsert = () => db.prepare(`INSERT INTO ...`).bind(...).run();

try {
  await doInsert();
} catch (err) {
  const msg = err instanceof Error ? err.message : '';
  if (msg.includes('no such table') || msg.includes('SQLITE_ERROR')) {
    await db.prepare(`CREATE TABLE IF NOT EXISTS ...`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS ...`).run();
    await doInsert(); // リトライ
  }
}
```

### 教訓
- テーブルが存在しないことは「登録拒否」の理由にしてはいけない。新規登録文脈では自動作成してリトライするのが正しい
- catch のエラーメッセージを握りつぶすと原因追跡が不可能になる。少なくともエラー文字列をレスポンスに含めること
- `check-name` エンドポイント側は catch で `{ exists: false }` を返していたため「登録」ボタンは有効になる。しかし POST 側で失敗するという非対称な挙動が混乱を招いた

---

## 2. 重複チェック用 GET エンドポイントのテーブル不在は無害だが非対称を生む

### 現象
`GET /api/repositories/search/category-group/check-name` はテーブルが存在しない場合に例外を catch して `{ exists: false }` を返す。これによりクライアント側では「名前は使える」と判定してボタンが有効になる。

### 問題
POST 側はテーブル不在で失敗するため、ボタンは押せるのに登録できないという矛盾が生じる。

### 対処
- `check-name` の catch: "no such table" 系エラーはログを出さず `{ exists: false }` を返す（テーブル不在 = 名前は使えると解釈）
- POST 側で自己修復してリトライすることで整合を取る

---

## 3. カテゴリグループ機能のテーブル設計

### テーブル: `keyword_category_groups`

```sql
CREATE TABLE IF NOT EXISTS keyword_category_groups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  description TEXT,
  categories TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_keyword_category_groups_user_id ON keyword_category_groups(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_keyword_category_groups_user_name ON keyword_category_groups(user_id, group_name);
```

### `categories` カラムの格納形式
カテゴリラベルをアルファベット順ソートして JSON 配列文字列で格納する。

```typescript
JSON.stringify(categories.slice().sort())
// 例: '["bugfix","feature","ui"]'
```

照合時もソートして比較することで順序差異による不一致を防ぐ。

```typescript
const cats: string[] = JSON.parse(row.categories);
const sorted = cats.slice().sort();
return sorted.length === selectedLabels.length && sorted.every((v, i) => v === selectedLabels[i]);
```

---

## 4. z-index 階層の整理（このセッション時点）

| 要素 | z-index |
|---|---|
| 各種モーダル | 10001〜10200 |
| トースト通知 | 10300 |
| カテゴリグループ作成モーダル | 10400 |

新しいモーダルを追加するときは既存の最大値を確認してから割り当てること。

---

## 5. カテゴリバッジのマルチ選択トグル設計

### 状態管理
`selectedLabel`（単一文字列）を `activeLabels`（`Set<string>`）に置き換えた。

### 「すべて」ボタンの特殊ルール
- ON: 全カテゴリを `activeLabels` に追加 → 全キーワード表示
- OFF: `activeLabels` をクリア → キーワード表示エリアが空

「すべて」ボタンの ON/OFF 状態は「全カテゴリが activeLabels に含まれているか」で動的に判定する。ボタン自体に状態を持たせない。

### グループスキャンのトリガー条件
```
「すべて」が OFF かつ activeLabels.size >= 2
```
この条件のときだけ `/api/repositories/search/category-group?labels=...` を呼ぶ（300ms デバウンス）。

---

## 6. 名前重複バリデーションのデバウンス

グループ名入力欄では 350ms のデバウンスでサーバーに重複チェックを送る。入力のたびに `nameIsValid` を false にリセットし、レスポンスを受け取って初めて true/false を確定する。「登録」ボタンは `name.length > 0 && nameIsValid` の両立時のみ有効にする。

```javascript
nameInput.addEventListener('input', function() {
  nameIsValid = false;       // 即座に無効化
  setConfirmState();         // ボタンを無効化
  clearTimeout(nameCheckTimer);
  nameCheckTimer = setTimeout(function() {
    fetch('/api/.../check-name?name=' + encodeURIComponent(name), ...)
      .then(...)             // nameIsValid を確定してボタン状態を更新
  }, 350);
});
```

---

## 7. `description` カラム未存在による INSERT 失敗（#371 で修正）

### 現象
登録ボタンを押すと「グループの登録に失敗しました: D1_ERROR: table keyword_category_groups has no column named description: SQLITE_ERROR」と表示されて登録できなかった。

### 原因
migration 0037 の最初のバージョンに `description` カラムが含まれていなかった。そのバージョンで先にテーブルが自動作成されていたため、後から `description` を追加した migration を適用しても `CREATE TABLE IF NOT EXISTS` はテーブルが存在するとスキップされ、カラムが追加されなかった。

### 対処
`ensureSchema()` ヘルパー内に以下を追加した。

```typescript
try {
  await db.prepare(`ALTER TABLE keyword_category_groups ADD COLUMN description TEXT`).run();
} catch { /* カラムが既に存在する場合は無視 */ }
```

### エラー検出条件の修正
`SQLITE_ERROR` という文字列は広すぎるため、`no column named` を個別に検出するよう変更した。

```typescript
if (msg.includes('no such table') || msg.includes('no column named')) {
  await ensureSchema();
  await doInsert(); // リトライ
}
```

### 教訓
- migration のテーブル定義を後から変更した場合、既存テーブルへのカラム追加は `ALTER TABLE ADD COLUMN` でしか行えない。`CREATE TABLE IF NOT EXISTS` はカラム変更を反映しない
- 自己修復パターンでは `no such table`（テーブル不在）と `no column named`（カラム不在）を別々に検出して同じ `ensureSchema()` に流すのが安全
- `SQLITE_ERROR` は広すぎるマッチ条件。具体的なエラーメッセージ部分文字列で絞ること
