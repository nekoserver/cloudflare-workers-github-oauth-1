# ISSUES — cloudflare-workers-github-oauth-1

作成日: 2026-05-25

---

## 1. テーブルメタデータの二重管理と登録漏れ問題

### 対象

`src/index.ts` の `STATUS_TABLE_DEFINITIONS` / `TABLE_GROUP_MAP` / `COLUMN_FK_TARGETS` / `TABLE_COLUMN_KEYS` と、D1 テーブル `table_catalog` / `table_column_keys` の二重管理構造、および `er-diagram.html` の `SCHEMA` / `GROUPS` ハードコード。

---

### 発端となった具体的な事象

D1 上に存在するテーブル `column_concepts`、`repo_cache`、`user_cache` が以下の場所にまったく登録されていなかった:

- `STATUS_TABLE_DEFINITIONS`（マイグレーション状況テーブルに表示されない）
- `TABLE_GROUP_MAP`（ER 図でグループ分類されず灰色ヘッダとなる）
- `er-diagram.html` の `SCHEMA` / `GROUPS`

その結果として:
- `/status` のマイグレーション状況テーブルにこれら3テーブルが現れない
- `/status` の「テーブルグループ: 0 Undefined」フィルタを選択しても行がない（`data.tables` に存在しないため）
- ER 図凡例の「Undefined」フィルタが「手動で更新する」前に機能しない

対処療法として `STATUS_TABLE_DEFINITIONS` への追記と status.ts 初期テーブルリストへの追加で解決したが、根本的な構造問題は残存している。

---

### 原因の整理

#### 原因 A — テーブル追加作業と登録作業が分離している

新しいテーブルを D1 に追加する際の手順が以下のように分断されている:

| 手順 | 場所 | 依存 |
|---|---|---|
| 1. D1 マイグレーション | `.sql` ファイル | 必須 |
| 2. STATUS_TABLE_DEFINITIONS 追記 | `src/index.ts` | 任意扱いになりがち |
| 3. TABLE_GROUP_MAP 追記 | `src/index.ts` | 任意扱いになりがち |
| 4. COLUMN_FK_TARGETS 追記 | `src/index.ts` | 任意扱いになりがち |
| 5. TABLE_COLUMN_KEYS 追記 | `src/index.ts` | 任意扱いになりがち |
| 6. er-diagram.html の SCHEMA 追記 | `er-diagram.html` | 任意扱いになりがち |
| 7. er-diagram.html の GROUPS 追記 | `er-diagram.html` | 任意扱いになりがち |

手順 1 だけが「テーブルが使えるようにする」ために必須であり、残りは「管理画面上の正確な表示」のためにのみ必要。緊急度・可視性の差からスキップされやすい。

#### 原因 B — 「真の単一ソース」が決まっていない

このリポジトリには `table_catalog` と `table_column_keys` という D1 テーブルが存在し（migration 0026）、本来これらがテーブルメタデータの正規置き場所のはずである。しかし実態は TypeScript ハードコードと D1 の二重管理になっており、どちらも「正しい」とも「古い」とも言い切れない状態になっている。

```
【現状の二重管理構造】

TypeScript ハードコード側:                D1 側:
- STATUS_TABLE_DEFINITIONS           ←→  table_catalog
- TABLE_GROUP_MAP                    ←→  table_catalog.group_name
- TABLE_COLUMN_KEYS / COLUMN_FK_TARGETS ←→ table_column_keys
- er-diagram.html SCHEMA/GROUPS      ←→  （D1から動的生成すれば不要なはず）
```

どちらかが更新されてももう一方が追随しない状態が恒常的に発生する。

#### 原因 C — 自動検出機能の存在が「登録しなくてもよい」錯覚を生む

`/status` には `user_status_show_autodetected_tables` cookie が ON の場合に D1 上の未知テーブルを自動検出して表示する機能がある。この機能は安全網として有用だが、「自動検出があるから手動登録しなくていい」という誤認を生みやすい。

自動検出では取得できないメタデータ（グループ分類・FK 定義・マイグレーション番号・説明文）は常に空になるため、運用上の情報価値が低い状態での「なんとなく見えている」状態を作り出してしまう。

---

### 設計段階でどう回避すべきであったか

#### 回避策 1 — テーブル追加をひとつのアトミックな作業単位にする

テーブル追加とメタデータ登録を「同一コミット・同一 PR に含める」をルールとして設計段階で決定しておくべきだった。具体的には以下のチェックリストを PR テンプレートやドキュメントに組み込む:

```
## テーブル追加チェックリスト

- [ ] マイグレーション .sql を作成した
- [ ] STATUS_TABLE_DEFINITIONS にエントリを追加した（migration番号・description・syncPolicy）
- [ ] TABLE_GROUP_MAP でグループを割り当てた
- [ ] FK があれば COLUMN_FK_TARGETS に追記した
- [ ] PK/FK/UK/IDX があれば TABLE_COLUMN_KEYS に追記した
- [ ] er-diagram.html の SCHEMA と GROUPS.xxx.tables に追加した
```

このチェックリストが存在していれば、`column_concepts` / `repo_cache` / `user_cache` のような宙ぶらりんテーブルは PR レビュー段階で発見できた。

#### 回避策 2 — 単一ソースをどちらかに統一する

設計初期に「TypeScript を主とするか、D1 を主とするか」を決定しておくべきだった。

**TypeScript を主とする場合（現状に近いが徹底する）:**
- `table_catalog` / `table_column_keys` テーブルへの書き込みを廃止し、D1 には純粋なビジネスデータのみを格納する
- すべてのメタデータは TypeScript ハードコードから読む
- 新テーブル追加 = TypeScript への登録 + マイグレーション .sql を常にセットにする

**D1 を主とする場合（より動的な構成）:**
- Worker 起動時に `table_catalog` を読んで `STATUS_TABLE_DEFINITIONS` 相当の情報を動的に構築する
- 新テーブル追加 = マイグレーション .sql に `INSERT INTO table_catalog` と `INSERT INTO table_column_keys` を含める
- TypeScript のハードコードは削除し、`er-diagram.html` の SCHEMA/GROUPS も D1 から生成する API エンドポイントを設ける

どちらが正解かはシステムの性質（変更頻度・チーム規模・デプロイ制約）に依存するが、**「どちらかに決める」という意思決定の欠如が最大の問題**だった。

#### 回避策 3 — 自動検出は最後の安全網と位置づけ、「未登録テーブルを検知したら警告を出す」に留める

自動検出機能を「表示する」のではなく「警告を出す」だけにすれば、開発者が「登録していないテーブルが存在する」と気づきやすくなる。現状は自動検出テーブルが通常テーブルと同列に並んでしまうため、気づきにくい。

設計時の望ましい動作:
- 未登録テーブルを検知 → `/status` の目立つ位置にアラートバナーを表示（「未登録テーブルが X 件あります。STATUS_TABLE_DEFINITIONS への登録が必要です」）
- 自動検出テーブルは表示しない（あるいは明確に「要登録」バッジ付きで別セクションに隔離する）

---

### 現時点での暫定対処と残存リスク

| 対処 | 状態 |
|---|---|
| `column_concepts` / `repo_cache` / `user_cache` を STATUS_TABLE_DEFINITIONS に追記 | 完了（[`df48d90`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/df48d90)） |
| status.ts の初期テーブルリストに `cols: []` で追加 | 完了（同上） |
| TABLE_GROUP_MAP には登録せず Undefined のまま | 暫定（用途が判明次第グループ割り当て推奨） |
| `table_catalog` / `table_column_keys` との二重管理 | **未解決** |
| er-diagram.html の SCHEMA に未追加 | **未解決**（cols が不明のため） |
| チェックリスト運用ルール化 | **未実施** |

`column_concepts` / `repo_cache` / `user_cache` の実際の用途（どの機能のために作られたか）が判明した時点で:

1. `TABLE_GROUP_MAP` に適切なグループを割り当てる
2. `er-diagram.html` の SCHEMA / GROUPS に実際のカラム定義とともに追加する
3. FK があれば `COLUMN_FK_TARGETS` に追記する

を実施することが推奨される。

---

### 関連ファイル

| ファイル | 役割 |
|---|---|
| `src/index.ts` | STATUS_TABLE_DEFINITIONS / TABLE_GROUP_MAP / COLUMN_FK_TARGETS / TABLE_COLUMN_KEYS / GROUP_LABELS / GROUP_COLORS の定義 |
| `src/views/status.ts` | 初期テーブルリスト（ハードコード）/ ER 図レンダリング / Undefined フィルタ |
| `er-diagram.html` | SCHEMA / GROUPS / RELATIONS のハードコード（スタンドアロン ER 図ページ） |
| `migrations/*.sql` | D1 マイグレーションファイル（テーブル作成の実体） |
