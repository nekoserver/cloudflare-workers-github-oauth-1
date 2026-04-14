# NOTICE 2026-04-13

## 論理FK (COLUMN_FK_TARGETS) で異名 toCol を持つ定義を追加したら FK検証が "no such column" で失敗する

**対象**: `src/index.ts` の `COLUMN_FK_TARGETS` / `loadSchemaRelations` / `GET /api/status/schema` の論理FKマージ処理、および `POST /api/status/fk-verify` の JOIN クエリ。

### 事象

`/status` の「FK検証」モーダルで以下のエラーが大量に出る状態になった:

```
user_sessions.current_workspace_id → workspaces.current_workspace_id
エラー: D1_ERROR: no such column: t.current_workspace_id: SQLITE_ERROR

commit_calendar_cache.workspace_id → workspaces.workspace_id
エラー: D1_ERROR: no such column: t.workspace_id: SQLITE_ERROR

email_audit_anomalies.target_user_id → user_sessions.target_user_id
エラー: D1_ERROR: no such column: t.target_user_id: SQLITE_ERROR
```

エラーメッセージを読むと分かるが、矢印の右辺（toTable.toCol）が誤っている。
`workspaces.current_workspace_id` や `workspaces.workspace_id` は存在せず、正しくは
`workspaces.id`。`user_sessions.target_user_id` は存在せず、正しくは
`user_sessions.user_id`。

### 原因

論理FK (`COLUMN_FK_TARGETS`) から ER 図リレーションを合成するコードが、
**toCol = fromCol と同名前提** でハードコードされていた。

```ts
// 修正前 (src/index.ts)
relations.push([fromTable, fromCol, toTable, fromCol, '論理FK']);
//                                          ^^^^^^^ ← fromCol を流用
```

以下のコミットで `workspace_id → workspaces` や `target_user_id → user_sessions` のような
**異名FK** を論理FKとして追加した結果、上記の同名前提が破綻した。

- `c625ee2` user_id/workspace_id の論理FKを COLUMN_FK_TARGETS へ追加し検証APIを新設

### 解決方法

`COLUMN_FK_TARGETS` の構造を保ったまま、**異名FK の toCol 名だけをオーバーライドする副次マップ**を追加した。

```ts
// src/index.ts
export const COLUMN_FK_TARGET_COLUMNS: Record<string, string> = {
  'user_sessions.current_workspace_id': 'id',
  'commit_calendar_cache.workspace_id': 'id',
  'email_audit_anomalies.target_user_id': 'user_id',
  // ... (全異名FKのエントリ)
};

export function resolveLogicalFkTargetCol(fromTable: string, fromCol: string): string {
  return COLUMN_FK_TARGET_COLUMNS[`${fromTable}.${fromCol}`] ?? fromCol;
}
```

論理FKをマージする箇所（`/api/status/schema` と `loadSchemaRelations`）で
`resolveLogicalFkTargetCol()` を呼び、正しい toCol で `[fromTable, fromCol, toTable, toCol, '論理FK']`
をリレーションに push するよう修正した。

修正コミット: `eb78537`（論理FKの異名toCol解決機構を追加しFK検証エラーを修正）

### 今後の対策

#### ルール: 論理FK を新規追加するときは異名かどうかを毎回確認する

`COLUMN_FK_TARGETS` に新しいエントリを足す際は、以下の 2 ステップを必ず踏むこと:

1. **fromCol と toTable の PK/UK カラム名が一致するか**を確認する
2. 一致しない（異名FK）場合、**同時に `COLUMN_FK_TARGET_COLUMNS` にも toCol を登録する**

例:
```ts
// 同名FK (一致) → COLUMN_FK_TARGET_COLUMNS への登録不要
COLUMN_FK_TARGETS.repo_color_settings = { repo_name: 'installation_permissions' };
// ↑ installation_permissions.repo_name (UK) を参照 — 同名

// 異名FK (不一致) → COLUMN_FK_TARGET_COLUMNS への登録必須
COLUMN_FK_TARGETS.commit_calendar_cache = { workspace_id: 'workspaces' };
COLUMN_FK_TARGET_COLUMNS['commit_calendar_cache.workspace_id'] = 'id';
// ↑ workspaces.id (PK) を参照 — 異名
```

#### テスト: 異名FK解決を常時検証する

`src/utils/mergeColumnsFromRows.test.ts` に `resolveLogicalFkTargetCol` の
ケース別テストを用意済み。新しい論理FKを追加したら同ファイルのテストにも
ケースを追加して CI で回し、デプロイ前に FK検証エラーを検出する。

#### 根本解決: column_concepts マスタ設計への移行

現状の `COLUMN_FK_TARGETS` + `COLUMN_FK_TARGET_COLUMNS` の二段構えは
次善策。**カラム名の自由を保ちつつ内容物の型を DB に埋め込む設計**（`column_concepts`
マスタ + `concept_name` 紐付けカラム）を別PRで実装予定。

`column_concepts` 導入後は、ある concept を持つ全カラムが自動的に
「authoritative_table.authoritative_column」を参照するとみなせるため、
`COLUMN_FK_TARGET_COLUMNS` も不要になる。移行が完了したら本 NOTICE に追記する。

### 関連コミット

- [`c625ee2`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/c625ee2) — 異名FKを含む論理FKを追加したコミット（ここで問題が顕在化）
- [`eb78537`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/commit/eb78537) — `COLUMN_FK_TARGET_COLUMNS` + `resolveLogicalFkTargetCol` を導入して修正

### 関連PR

- [`nekoserver/cloudflare-workers-github-oauth-1#250`](https://github.com/nekoserver/cloudflare-workers-github-oauth-1/pull/250) — 本件を含む ER 図整備PR
