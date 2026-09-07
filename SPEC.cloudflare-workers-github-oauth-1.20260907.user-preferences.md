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
  accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, pref_key)
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at ON user_preferences(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_preferences_accessed_at ON user_preferences(accessed_at);
```

- `user_id`: 既存の`user_sessions.user_id`と同じ値(GitHub user id相当)
- `pref_key`: 下記2-2の許可リストに存在するキーのみ許容
- `pref_value`: 文字列のみ(真偽値は`'on'`/`'off'`、数値は文字列化して格納。既存Cookie実装の値表現をそのまま踏襲する)
- `updated_at`: 値が**書き変わった**時刻(値の変更が無い書き込み=同じ値でのUPSERTでは更新しない、下記2-4参照)
- `accessed_at`: そのキーが最後に**参照(読み出し)**された時刻。書き込み時にも更新する(書き込みは「値を書いてすぐ使う」ことが多いため)。2-4のパージ判断に使う

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

### 2-3. `user_preferences_history`(変更履歴の追記専用テーブル)

「いつ、どの値からどの値に変わったか」を残すため、`ai_summary_reviews`・`cf_auth_access_log`・`public_key_security_events`と同じ「現在値テーブル+追記専用ログテーブル」のパターンを採る。`user_preferences`本体は現在値のみを持ち、履歴はこちらに追記する。

```sql
CREATE TABLE IF NOT EXISTS user_preferences_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  pref_key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_preferences_history_lookup ON user_preferences_history(user_id, pref_key, changed_at);
```

- 書き込みAPI(3-1)は、UPSERT前に現在値を1回読み、**値が実際に変わった場合のみ**この履歴テーブルへ1行追記する(同じ値を書き直しただけの場合は追記しない — 無意味な履歴の増殖を防ぐ)
- `old_value`は初回設定時は`NULL`
- 用途: 「このユーザーのこの設定はいつ・何から何に変わったか」を`/status`等の管理画面から追える。個々の設定の変更履歴を柔軟に追うための機構

### 2-4. パージ — 2つの独立したタイミングを持つ

パージは「コードから消えたキーか」の一択ではなく、**タイミングが異なる2種類の判断**を独立に用意する。

**(a) 許可リスト駆動パージ(設定そのものの廃止)**

設定そのものを廃止する(コードからCookie/設定を削除する)ときは、`USER_PREFERENCE_KEYS`からキーを外すのとセットで、以下のような削除migrationを追加する。

```sql
DELETE FROM user_preferences WHERE pref_key = '<廃止したキー名>';
DELETE FROM user_preferences_history WHERE pref_key = '<廃止したキー名>';
```

このリポジトリの「新テーブル追加時はコピペ可能なSQLを明示する」ルール(CLAUDE.mdルール14)をそのまま適用し、廃止のたびにユーザーへ実行してもらうSQLを提示する運用とする。

**(b) 参照タイミング駆動パージ(放置された行の掃除)**

設定自体は現役でも、特定ユーザーがそのページ/機能を使わなくなり長期間`accessed_at`が更新されていない行は、個々のキーの廃止とは無関係に掃除したい場合がある(退会・長期未ログインユーザーの残骸等)。これは`accessed_at`列があるからこそ可能になる、タイミングを問わず実行できる独立した掃除。

```sql
DELETE FROM user_preferences WHERE accessed_at < datetime('now', '-365 days');
```

- 実行タイミングは固定しない(管理者が任意のタイミングで手動実行、または将来Cron Triggerで定期実行)。**「いつパージするか」を許可リストの改廃タイミングに縛られず自由に選べる**ようにするのがこの列を持つ目的
- `user_preferences_history`は`changed_at`で同様に古い行を独立してパージできる(例: 直近20件/キーだけ残す、等)。1つのキーについて履歴が無限に積まれることを避けたい場合に使う

```sql
DELETE FROM user_preferences_history
WHERE id NOT IN (
  SELECT id FROM user_preferences_history AS h2
  WHERE h2.user_id = user_preferences_history.user_id AND h2.pref_key = user_preferences_history.pref_key
  ORDER BY h2.changed_at DESC LIMIT 20
);
```

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
  const db = c.env.DB;
  // 履歴へ残すため、UPSERT前に現在値を読む(1件だけのpoint lookupなので許容)
  const current = await db.prepare(
    `SELECT pref_value FROM user_preferences WHERE user_id = ? AND pref_key = ?`
  ).bind(user.sub, key).first<{ pref_value: string }>();

  await db.prepare(
    `INSERT INTO user_preferences (user_id, pref_key, pref_value, updated_at, accessed_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(user_id, pref_key) DO UPDATE SET
       pref_value = excluded.pref_value,
       updated_at = CASE WHEN excluded.pref_value != user_preferences.pref_value THEN excluded.updated_at ELSE user_preferences.updated_at END,
       accessed_at = excluded.accessed_at`
  ).bind(user.sub, key, String(value)).run();

  // 値が実際に変わった場合のみ履歴へ追記(同じ値の書き直しでは追記しない)
  if (!current || current.pref_value !== String(value)) {
    await db.prepare(
      `INSERT INTO user_preferences_history (user_id, pref_key, old_value, new_value, changed_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(user.sub, key, current?.pref_value ?? null, String(value)).run();
  }

  return c.json({ message: '設定を保存しました', key, value }, 200);
});
```

書き込みはCookieへは行わない(D1が唯一の情報源)。`updated_at`は値が実際に変わったときだけ進み、`accessed_at`は書き込みのたびに進む(2-1参照)。

### 3-2. 読み出し

ページ描画時(`GET /d1-query-catalog`等)に、そのページで使う設定キーだけをまとめて取得する。取得と同時に`accessed_at`を更新する(2-4(b)の参照タイミング駆動パージの判断材料にするため)。

```ts
const prefs = await c.env.DB.prepare(
  `SELECT pref_key, pref_value FROM user_preferences WHERE user_id = ? AND pref_key IN (?)`
).bind(user.sub, 'd1_query_catalog_sort').all<{ pref_key: string; pref_value: string }>();

// レスポンスを遅らせないよう、accessed_at更新はwaitUntilで非同期に行う
c.executionCtx.waitUntil(
  c.env.DB.prepare(
    `UPDATE user_preferences SET accessed_at = datetime('now') WHERE user_id = ? AND pref_key = ?`
  ).bind(user.sub, 'd1_query_catalog_sort').run()
);
```

D1に値が無い場合(未設定)は、CLAUDE.mdルール27と同じ「D1優先→ハードコードデフォルト」に従い、コード側のデフォルト値(`d1_query_catalog_sort`なら`'count'`)を使う。**Cookie/localStorageは中間フォールバックとしてもう使わない** — D1がログイン中ユーザーの唯一の情報源になるため、フォールバック段は不要になる。

`c.executionCtx`はテスト環境(Vitest)では存在しないため、CLAUDE.mdルール28の`recordApiAccess`と同じく`try/catch`で保護し、`accessed_at`更新の失敗・スキップがテストを500にしないようにする。

### 3-3. クライアント側

```js
fetch('/api/preferences/d1_query_catalog_sort', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ value: 'name' }),
});
```

`document.cookie`への書き込み・`localStorage`への書き込みは行わない。ページ遷移・リロードのたびにサーバーがD1から読んだ値で初期描画するため、クライアント側での永続化コードが丸ごと不要になる。

### 3-4. 変更履歴の参照

`/status`の保存データモーダル、または将来の専用画面から、以下のようなクエリで個々の設定の変更履歴を確認できる。

```sql
SELECT pref_key, old_value, new_value, changed_at
FROM user_preferences_history
WHERE user_id = ? AND pref_key = ?
ORDER BY changed_at DESC
LIMIT 20;
```

---

## 4. `d1_query_catalog_sort`の移行手順(最初の移行対象)

`d1_query_catalog_sort`は既にPR #1664で`user_preferences`(`accessed_at`・履歴テーブル無しの初版)へ移行済み。本節の追加分(2-1の`accessed_at`列・2-3の`user_preferences_history`)を反映する追加migrationの手順は以下。

1. `migrations/<N>_add_accessed_at_to_user_preferences.sql`で`ALTER TABLE user_preferences ADD COLUMN accessed_at TEXT NOT NULL DEFAULT (datetime('now'));`を実行し、インデックスも作成する
2. `migrations/<N+1>_create_user_preferences_history.sql`で2-3の`user_preferences_history`テーブルを作成
3. `POST /api/preferences/:key`(3-1)を、UPSERT前に現在値を読み、値が変わった場合のみ履歴へ追記するロジックに更新
4. `GET /d1-query-catalog`(3-2)の読み出しに、`accessed_at`を非同期更新する`waitUntil`呼び出しを追加(テスト環境での`executionCtx`未定義に対する`try/catch`保護込み)
5. 新規に`user_preferences`テーブルから移行する設定については、初版の手順(旧Cookie読み取り→D1書き込みの移行互換コード)をそのまま適用する

---

## 5. 既存Cookie群の移行方針(将来)

- 全30種類以上を一度に移行するのではなく、**新規追加・既存の大きな変更が入るタイミングで該当Cookieだけ`user_preferences`へ寄せる**、という漸進的な方針を採る
- 移行の優先順位は「変更頻度が高い」「複数ページで参照される」設定から
- 移行が完了しコードからCookie設定処理が消えたら、2-4(a)のパージSQLで残存Cookie相当のD1行(存在しない)は気にする必要は無いが、**もし過去にCookieのみで管理していた設定を後から`user_preferences`へ移す場合は、移行初回のみ旧Cookie値を一度D1へ取り込む処理を入れる**(4章5番と同じパターン)

---

## 6. 未決定事項(実装前に確認したいこと)

- `user_preferences`・`user_preferences_history`を`/status`ページの管理対象テーブルとして表示するか(表示する場合、行数がユーザー数×設定数で増えるため、通常の`COUNT(*)`だけで十分か検討)
- 初回移行時の「Cookie→D1」互換コードをどのタイミングで削除するか
- 2-4(b)の参照タイミング駆動パージ・履歴の直近N件保持パージを、手動実行のSQL提示のままにするか、将来Cron Triggerで定期実行するか(このリポジトリはCloudflare Workers Cronの導入例が無いため、導入するなら別途検討が必要)
- 履歴テーブルの`old_value`/`new_value`は生の値をそのまま保存する。個人情報を含む可能性のある設定キーを将来追加する場合、履歴に残してよいかをキーごとに判断する必要がある(現時点の`d1_query_catalog_sort`は`'name'`/`'count'`のみで問題ない)
