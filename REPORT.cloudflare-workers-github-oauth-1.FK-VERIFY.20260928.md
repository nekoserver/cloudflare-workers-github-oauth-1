# REPORT — PR #2117 FK検証APIの対象と孤立判定の見直し

**対象日**: 2026-09-28  
**対象PR**: #2117「FK検証APIの対象と孤立判定を見直す」  
**対象機能**: `/status` のER図から利用する `POST /api/status/fk-verify`

## 結論

PR #2117では、FK検証APIについて次の2点を見直した。

1. **検証対象を宣言済みの外部キー関係に限定した。**
   リクエストに書かれた識別子がSQLとして安全な形式かだけでなく、
   `COLUMN_FK_TARGETS`に登録された論理FK、またはD1の
   `PRAGMA foreign_key_list`で確認できる物理FKと完全一致することを必須にした。
2. **NULLを孤立レコードとして数えないようにした。**
   SQLiteではNULLの子キーは外部キー違反にならないため、孤立件数と検証母数の
   両方からNULLを除外した。

スキーマやマイグレーションによる外部キー制約の追加・削除は行っていない。
今回の変更は、既存の外部キー関係を調査するためのAPIに対する安全性と集計精度の改善である。

## 背景

`/status`のER図には、リレーションごとに実データをJOINし、対応する親行や孤立した
子行を確認する「FK検証」がある。APIは次の4項目をクライアントから受け取る。

- `fromTable`: 参照元テーブル
- `fromCol`: 参照元カラム
- `toTable`: 参照先テーブル
- `toCol`: 参照先カラム

変更前も識別子を`^[a-z_][a-z0-9_]*$`で検査していたため、SQLインジェクションに使う
記号は渡せなかった。しかし、正しい形式の任意のテーブル名・カラム名を組み合わせると、
ER図に存在しない関係でもJOINを実行し、サンプル行を取得できた。

このAPIは認証必須だが、認証済み利用者に対しても、FK検証という目的を超えて任意の
テーブルを参照できる必要はない。そのため、文字種の検証に加えて、関係そのものを
許可リスト方式で検証する必要があった。

## 実装内容

### 1. 論理FKの完全一致判定

`src/index.ts`に`isDeclaredLogicalFkRelation`を追加した。この関数は次の両方を確認する。

- `COLUMN_FK_TARGETS[fromTable][fromCol]`が`toTable`と一致する
- `resolveLogicalFkTargetCol(fromTable, fromCol)`が`toCol`と一致する

後者により、次のような参照元と参照先でカラム名が異なる関係も正しく扱える。

```text
commit_calendar_cache.workspace_id -> workspaces.id
ai_summary_reviews.summary_request_id -> ai_summary_log.request_id
```

参照先テーブルだけが一致していても、参照先カラムが違えば許可しない。

### 2. 物理FKの確認

論理FKに一致しない場合は、参照元テーブルに対して
`PRAGMA foreign_key_list(<fromTable>)`を実行する。その結果の`table`、`from`、`to`が
リクエストの`toTable`、`fromCol`、`toCol`と完全一致する場合だけ、物理FKとして許可する。

論理FKにも物理FKにも一致しない場合は、HTTP 400と
`Relation is not declared as a foreign key`を返し、JOINや行サンプル取得は実行しない。

### 3. NULLを除外した孤立判定

変更前のLEFT JOINでは、子キーがNULLの行も参照先と一致しないため、孤立行に含まれていた。
PR #2117では、孤立サンプル・孤立件数の条件に次を追加した。

```sql
f.<fromCol> IS NOT NULL
```

孤立率の分母となる参照元件数にも同じ条件を適用した。これにより、孤立率は
「FK値が設定されている子行のうち、親行が存在しない割合」を表す。

## 許可・拒否の例

| 指定した関係 | 種別 | 結果 |
|---|---|---|
| `team_members.user_id -> user_sessions.user_id` | 宣言済み論理FK | 許可 |
| `commit_calendar_cache.workspace_id -> workspaces.id` | 参照先カラム上書きのある論理FK | 許可 |
| DBの`FOREIGN KEY`句に存在する関係 | 物理FK | 許可 |
| `user_sessions.user_id -> ai_summary_log.request_id` | 未宣言 | 拒否 |
| `commit_calendar_cache.workspace_id -> workspaces.workspace_id` | 参照先カラム誤り | 拒否 |

## テスト

`src/fk-verification.test.ts`を追加し、次のケースを回帰テストにした。

- 同名カラムの宣言済み論理FKを許可する
- `COLUMN_FK_TARGET_COLUMNS`で参照先カラムを上書きした論理FKを許可する
- 未宣言のテーブル関係を拒否する
- 宣言と異なる参照先カラムを拒否する

実行結果:

```text
npx vitest run src/fk-verification.test.ts src/column-fk-targets-completeness-20260820.test.ts
Test Files  2 passed (2)
Tests      12 passed (12)
```

`npm run typecheck`は実行したが、今回触れていない既存テストファイルの型エラーにより失敗した。
`npm test`は全体スイートが長時間完了しなかったため中断した。対象テストは上記の個別実行で
成功している。

## 影響範囲

- `/status`画面から送られる正規のFK検証リクエストは引き続き利用できる。
- ER図に未登録かつDB制約にも存在しない任意の組み合わせは、今後HTTP 400になる。
- NULLを含む任意FKでは、変更後の孤立件数・孤立率が変更前より小さくなる場合がある。
- テーブル定義、既存データ、外部キー制約、CASCADE設定への変更はない。

## 今後の課題

- 現在の回帰テストは論理FK判定関数を直接検証している。D1モックを用いたAPI統合テストを
  追加すれば、物理FKの許可、未宣言関係のHTTP 400、NULL除外SQLまで自動検証できる。
- `COLUMN_FK_TARGETS`への論理FK登録が漏れると、その関係は物理FKがない限り検証できない。
  追加時は`src/column-fk-targets-completeness-20260820.test.ts`も合わせて確認する。

## 関連ファイル

- `src/index.ts` — 論理FK判定、物理FK照合、FK検証API、NULL除外集計
- `src/fk-verification.test.ts` — PR #2117で追加した回帰テスト
- `src/column-fk-targets-completeness-20260820.test.ts` — 論理FK定義の横断的な整合性テスト
- `NOTICE.cloudflare-workers-github-oauth-1.20260412.md` — 物理FKと論理FKの違い、およびER図への反映方針
