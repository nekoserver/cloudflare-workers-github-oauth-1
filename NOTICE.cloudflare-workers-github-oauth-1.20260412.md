# NOTICE — cloudflare-workers-github-oauth-1 (2026-04-12)

## 1. 論理FK（Logical Foreign Key）は `/status` の ER 図に完全には反映されない

### 現状

`/status` の ER 図（UML モーダル）には2つの描画経路がある:

| 経路 | 起点 | データソース | 論理FK反映 |
|---|---|---|---|
| グループER | グループ名バッジクリック | `/api/status/group-er`（`COLUMN_FK_TARGETS` を参照） | 反映される |
| フィルタUML | カラム一覧モーダルの「UMLを作成」 | `/api/status/schema`（`PRAGMA foreign_key_list` のみ） | **反映されない** |

「UMLを作成」経路は SQLite の `PRAGMA foreign_key_list` のみを読み取るため、
DB に `FOREIGN KEY` 制約が貼られていない論理FK（例: `commit_agent_log.request_id` →
`ai_summary_log.request_id`、`ai_summary_link_access_log.request_id` → `ai_summary_log.request_id`）は
関連線として描画されない。

### 論理FKとは

DBレベルの `FOREIGN KEY` 制約は貼られていないが、アプリケーション上は他テーブルの
カラムを意味的に参照しているカラム。CASCADE 連鎖の副作用や書き込み順序の制約を避けるため、
あえて DB 制約を設けずに同名カラムで緩く結合しているケース。

本リポジトリの現時点での論理FK一覧（`COLUMN_FK_TARGETS` に登録済み）:

- `commit_agent_log.request_id` → `ai_summary_log.request_id`
- `ai_summary_link_access_log.request_id` → `ai_summary_log.request_id`

### 完全反映にはテーブルの再設計と破壊的改修が必要

論理FKを ER 図に「DB制約ベース」で完全に反映させるには、以下のいずれかが必要である。
いずれも **破壊的（データ移行・ダウンタイム・既存コードの書き直しを伴う）** 改修となる:

#### 案A: マイグレーションで `FOREIGN KEY` 制約を追加する

SQLite は既存テーブルへの `ADD CONSTRAINT FOREIGN KEY` をサポートしないため、以下の手順が必要:

1. 新テーブル（同スキーマ + `FOREIGN KEY`）を作成
2. 既存データを `INSERT INTO ... SELECT` で移行
3. 旧テーブルを `DROP`
4. 新テーブルをリネーム
5. インデックスを再作成

この過程で:

- 親テーブル側の該当行が欠けていると INSERT が失敗する（孤立レコードの事前クレンジングが必要）
- 書き込み順序の制約が復活し、親レコードが書かれる前の子レコード書き込みが失敗する
- CASCADE 削除の連鎖が発生し得る
- D1 の本番データを移行する都合上、短時間のダウンタイムが発生する

#### 案B: `/api/status/schema` エンドポイントで論理FKをマージして返す

PRAGMA の結果に `COLUMN_FK_TARGETS` の論理FKをマージし、`isLogical: true` フラグ付きで返す。
クライアント側では破線のリレーション線として描画する（実線とは視覚的に区別する）。

- 破壊性は小さい（スキーマ変更不要・既存データへの影響なし）
- ただし ER 図上の「DB制約で保証されているか否か」が視覚的に曖昧になるため、
  凡例で「論理FK」を明確に区別する必要がある（本日追記したツールチップがその第一歩）

#### 案C: 現状維持（ドキュメントのみで補う）

ER 図には映らないまま、凡例ツールチップ・SPEC・NOTICE で論理FK の存在と意図を
ドキュメント化する。コード変更なし、データ影響なし。

### 推奨

- **短期**: 案C（本日実施: 凡例に「論理FK」ツールチップを追加済み） + 案B（破線リレーションで
  視覚的にも明示）を段階的に進める
- **長期**: 案A は **影響範囲が大きく、既存の書き込み順序・CASCADE 挙動に依存している箇所の
  全調査が必要**。実施する場合は別セッションで慎重に設計すること

### 関連ファイル

- `src/index.ts` — `COLUMN_FK_TARGETS`（論理FK定義）、`/api/status/schema`（PRAGMA のみ）、
  `/api/status/group-er`（`COLUMN_FK_TARGETS` を参照）
- `src/views/status.ts` — `normalizeGroupErToUml`、`renderFilteredErDiagram`、
  UML モーダルの凡例（論理FKツールチップ追加済み）
- `migrations/0025_create_commit_agent_log.sql` — `FOREIGN KEY` 制約なし
- `migrations/0029_create_ai_summary_link_access_log.sql` — `FOREIGN KEY` 制約なし
- `migrations/0016_create_ai_summary_reviews.sql` — こちらは `FOREIGN KEY` 制約あり（PRAGMA で拾える）

### 忘れると損するポイント

- 新しい論理FK（DB制約なしの意味的な参照）を追加する際は **必ず `COLUMN_FK_TARGETS` に登録する**。
  登録漏れはグループER経路でもリレーション線が出なくなる
- 「UMLを作成」経路はキャッシュされた `window.__erRelations` を使うため、論理FKを追加しても
  フィルタUML側には自動的には反映されない。案B を実装しない限りこの差分は残る
- ER 図に線が出ないから「関連がない」と誤読しないよう、凡例の「論理FK」ツールチップを
  必ず確認する運用とする
