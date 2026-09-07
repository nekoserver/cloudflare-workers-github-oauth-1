# SPEC: user_preferences — Cookie乱立の解消

**対象**: このリポジトリ全体で30種類以上に増えたユーザー設定用Cookie(`user_theme`・`user_status_*`・`aichat_*`・`heritage_journey_*`・今回追加した`d1_query_catalog_sort`等)を、D1のキー単位テーブルへ段階的に移行するための設計。レビュー用のSPECであり、本ドキュメント自体はまだコードを変更しない。

---

## 1. 背景と問題

### 1-1. 現状

ログイン必須のページの個人設定は、これまで一貫して「1設定=1個別Cookie」というパターンで追加されてきた(`src/views/settings.ts`・`src/index.ts`の`POST /api/settings/*`エンドポイント群)。今回`/d1-query-catalog`の並び替え設定(`d1_query_catalog_sort`)を追加した際も同じパターンを踏襲した。

### 1-2. 何が問題か

- **Cookieヘッダーの肥大化**: 全Cookieはドメイン配下の全リクエストに毎回付与される。個別設定Cookieが増えるほどリクエストヘッダーが太り、ブラウザ/プロキシ側のヘッダーサイズ上限(一般に8KB前後)に近づくと `431 Request Header Fields Too Large` のような実害が出る
- **localStorageへの退避は対症療法**: Cookieが読めない場合にlocalStorageへフォールバックする実装(`d1_query_catalog_sort`含む)が増えてきたが、これはサーバー側から読めない・端末間で同期しない・そもそも「なぜCookieが読めないか」の根本原因(肥大化)を放置したままの弥縫策
- **設定の一覧性が無い**: 30個以上のCookie名がコード全体に散らばっており、「今どんな設定が存在するか」を一望できる場所が無い

### 1-3. なぜ単純なJSON blob化ではダメか

「1ユーザー1行、設定は全部JSONカラムに入れる」という素朴な移行案は、以下の理由で採用しない。

- 複数タブ・複数リクエストが同時に異なる設定を更新すると、「読む→JSONをマージ→書く」の間に他の更新が割り込んで巻き戻る競合が発生しうる(blob全体を書き換えるため、更新していないキーも上書きしてしまう)
- 使われなくなった設定キーがJSON内に残り続けても気づく手段が無く、無限に肥大化する

---

## 2. テーブル設計

### 2-1. `user_preferences`(キー単位テーブル)

1設定=1行にすることで、更新は必ず対象の`(user_id, pref_key)`だけに閉じたUPSERTになり、他のキーには一切触れない。「読む→マージ→書く」という中間状態そのものが存在しないため、複数タブ・複数設定の同時書き込みでも他の項目を巻き戻す事故が構造的に起きない(同一キーへの同時書き込みだけは最終書き込み優先になるが、これは現状のCookieと同じ挙動であり許容する)。

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT NOT NULL,
  pref_key TEXT NOT NULL,
  pref_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, pref_key)
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON user_preferences(updated_at);
```

- `user_id`: 既存の`user_sessions.user_id`と同じ値(GitHub user id相当)
- `pref_key`: 下記2-2の許可リストに存在するキーのみ許容
- `pref_value`: 文字列のみ(真偽値は`'on'`/`'off'`、数値は文字列化して格納。既存Cookie実装の値表現をそのまま踏襲する)

### 2-2. 許可リスト(コード側)

このリポジトリの`TABLE_COLUMN_KEYS`(`src/index.ts`)と同じ発想で、有効な設定キーをコード側の定数として持つ。

```ts
export const USER_PREFERENCE_KEYS: Record<string, { description: string; values: string[] | 'free' }> = {
  d1_query_catalog_sort: { description: '/d1-query-catalogの帯の並び替え順', values: ['name', 'count'] },
  // 今後、既存Cookieを移行するたびにここへ追加する
};
```

- `values`が配列の場合はその中の値のみ許容(不正な値はAPI側で400を返す)
- `values: 'free'`は任意文字列を許容する設定(自由入力のテキスト等、将来必要になった場合のため)
- **許可リストに無いキーへの書き込みはAPI側で拒否する**(ゴミの新規発生を防ぐ)

### 2-3. パージ(廃止済みキーの削除)

設定そのものを廃止する(コードからCookie/設定を削除する)ときは、`USER_PREFERENCE_KEYS`からキーを外すのとセットで、以下のような削除migrationを追加する。

```sql
DELETE FROM user_preferences WHERE pref_key = '<廃止したキー名>';
```

このリポジトリの「新テーブル追加時はコピペ可能なSQLを明示する」ルール(CLAUDE.mdルール14)をそのまま適用し、廃止のたびにユーザーへ実行してもらうSQLを提示する運用とする。

---

## 3. 読み書きAPI設計

### 3-1. 書き込み: `POST /api/preferences/:key`

既存の`POST /api/settings/*`エンドポイント群(設定ごとに個別ルート)は、当面はそのまま残す(全面置き換えは影響範囲が大きすぎる)。新規に追加する設定、および今回の`d1_query_catalog_sort`は、この汎用エンドポイント1本に集約する。

```ts
app.post('/api/preferences/:key', authMiddleware, async (c) => {
  const user = c.get('user');
  const key = c.req.param('key');
  const def = USER_PREFERENCE_KEYS[key];
  if (!def) {
    return c.json({ error: `未知の設定キーです: ${key}` }, 400);
  }
  const { value } = await c.req.json();
  if (def.values !== 'free' && !def.values.includes(value)) {
    return c.json({ error: `不正な値です: ${value}` }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO user_preferences (user_id, pref_key, pref_value, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, pref_key) DO UPDATE SET pref_value = excluded.pref_value, updated_at = excluded.updated_at`
  ).bind(user.sub, key, String(value)).run();
  return c.json({ message: '設定を保存しました', key, value }, 200);
});
```

書き込みはCookieへは行わない(D1が唯一の情報源)。

### 3-2. 読み出し

ページ描画時(`GET /d1-query-catalog`等)に、そのページで使う設定キーだけをまとめて取得する。

```ts
const prefs = await c.env.DB.prepare(
  `SELECT pref_key, pref_value FROM user_preferences WHERE user_id = ? AND pref_key IN (?)`
).bind(user.sub, 'd1_query_catalog_sort').all<{ pref_key: string; pref_value: string }>();
```

D1に値が無い場合(未設定)は、CLAUDE.mdルール27と同じ「D1優先→ハードコードデフォルト」に従い、コード側のデフォルト値(`d1_query_catalog_sort`なら`'count'`)を使う。**Cookie/localStorageは中間フォールバックとしてもう使わない** — D1がログイン中ユーザーの唯一の情報源になるため、フォールバック段は不要になる。

### 3-3. クライアント側

```js
fetch('/api/preferences/d1_query_catalog_sort', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ value: 'name' }),
});
```

`document.cookie`への書き込み・`localStorage`への書き込みは行わない。ページ遷移・リロードのたびにサーバーがD1から読んだ値で初期描画するため、クライアント側での永続化コードが丸ごと不要になる。

---

## 4. `d1_query_catalog_sort`の移行手順(最初の移行対象)

1. `migrations/<N>_create_user_preferences.sql`で2-1のテーブルを作成
2. `src/index.ts`に`USER_PREFERENCE_KEYS`定数と`POST /api/preferences/:key`を追加
3. `GET /d1-query-catalog`のCookie読み取り(`getCookieValue(..., 'd1_query_catalog_sort')`)をD1読み取りに置き換える
4. `src/views/d1QueryCatalog.ts`の並び替えボタンのクリックハンドラを、Cookie/localStorage書き込みから`fetch('/api/preferences/d1_query_catalog_sort', ...)`に置き換える。`persistSort`/`loadStoredSort`関数と、ページ読込時のCookie/localStorage同期処理はまるごと削除する
5. 併せて、既存の`d1_query_catalog_sort`Cookieを読んでいるユーザーがいる可能性を考慮し、初回移行時のみ「Cookieに値があればそれをD1へ一度だけ書き込んでからCookieを削除する」互換コードを一時的に入れる(次回リリースで削除)

---

## 5. 既存Cookie群の移行方針(将来)

- 全30種類以上を一度に移行するのではなく、**新規追加・既存の大きな変更が入るタイミングで該当Cookieだけ`user_preferences`へ寄せる**、という漸進的な方針を採る
- 移行の優先順位は「変更頻度が高い」「複数ページで参照される」設定から
- 移行が完了しコードからCookie設定処理が消えたら、2-3のパージSQLで残存Cookie相当のD1行(存在しない)は気にする必要は無いが、**もし過去にCookieのみで管理していた設定を後から`user_preferences`へ移す場合は、移行初回のみ旧Cookie値を一度D1へ取り込む処理を入れる**(4章5番と同じパターン)

---

## 6. 未決定事項(実装前に確認したいこと)

- `POST /api/preferences/:key`のレート制限・監査ログの要否(既存の`/api/*`集計ミドルウェアで自動集計はされる、CLAUDE.mdルール28)
- `user_preferences`を`/status`ページの管理対象テーブルとして表示するか(表示する場合、行数がユーザー数×設定数で増えるため、通常の`COUNT(*)`だけで十分か検討)
- 初回移行時の「Cookie→D1」互換コードをどのタイミングで削除するか
