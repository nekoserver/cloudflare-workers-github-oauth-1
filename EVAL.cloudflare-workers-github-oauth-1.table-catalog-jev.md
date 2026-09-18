# EVAL: Jevテーブルカタログ(table-catalog-jev)の計画と実装の評価

**対象**: `PLAN.cloudflare-workers-github-oauth-1.20260917.md` 3節(テーブル設計)が
描いた当初のJevテーブル設計と、実際に稼働している6テーブル
(migration 0144/0145/0146/0148)との差分を評価する。詳細な現状スキーマは
[`SPEC.cloudflare-workers-github-oauth-1.table-catalog-jev.md`](SPEC.cloudflare-workers-github-oauth-1.table-catalog-jev.md)
参照。機能全体(UI・API・プロセス)の評価は
[`EVAL.cloudflare-workers-github-oauth-1.ai-jev.md`](EVAL.cloudflare-workers-github-oauth-1.ai-jev.md)
に既にまとまっているため、本ドキュムントは**テーブル設計・カタログ化の観点のみ**に絞る。

---

## 1. 計画通りに実装できた点

**対象**: PLAN 3節「設計判断のポイント」。

| 計画 | 実績 |
|---|---|
| `jev_label_groups`/`jev_labels`は追記専用(UPDATE禁止) | 実装通り。UPDATE文は存在しない |
| 表示グループを文字列のまま持たず`jev_label_groups`に正規化 | 実装通り。`jev_labels.jev_group_id`でFK参照 |
| `share_id`をai-cache側の質問IDとの紐付けの起点にする | 実装通り。`jev_evaluations.share_id`は`ai_chat_shares.id`と同一 |
| `target_type`で「回答」と「元の質問文」を同じラベルで評価できるようにする | 実装通り。`target_type IN ('answer','source_question')` |
| `share_id`にINDEXを張る | 実装通り(名前は後述の通り変更あり) |

---

## 2. テーブル設計から変わった点

**対象**: PLAN 3節のCREATE TABLE文と、実際のmigration 0144(`migrations/0144_create_jev_tables.sql`)の差分。

| 計画 | 実績 | 変わった理由 |
|---|---|---|
| `jev_evaluations`に`user_id`列が無い(PLANのCREATE TABLE文に列自体が存在しない) | `user_id TEXT NOT NULL`(FK→user_sessions)を追加し、UNIQUE制約にも含めた | **PLAN段階の見落とし**。`share_id`だけでは複数ユーザーの評価が衝突する(D1は全ユーザー共有の1インスタンスであり、`user_id`によるテナント分離が他の全AIチャット系テーブルの標準パターン)。実装時に気づいて追加されたと見られるが、PLANにこの変更の記録・意図の言語化が残っていない |
| `jev_evaluations`のPRIMARY KEYは`(target_type, share_id, model, jev_label_id)`の複合PK | `id INTEGER PRIMARY KEY AUTOINCREMENT` + `UNIQUE INDEX idx_jev_evaluations_unique (target_type, user_id, share_id, model, jev_label_id)` | EVAL.ai-jev.md 2節で既に「効果は同じだが字面が異なる」と記録済み。ただし`user_id`が一意性キーに追加されている点はそちらでも明示的には触れられていない |
| `share_id`のINDEX名は`idx_jev_evaluations_share_id` | 実際は`idx_jev_evaluations_share`(`_id`が付かない) | 命名の単純な揺れ。動作に影響は無いが、PLANとコードを見比べる際に「別のインデックスか」と誤読させうる |
| `question_type`のコメントは「noul / choice / score」の3種類を想定 | 初期データ20件はすべて`'score'`。`noul`/`choice`型の実装・利用例は存在しない | Jev APIの実機確認(EVAL.ai-jev.md 3-1節)で`type:"score"`が主に使われる形だと判明し、他の型は結果的に未使用のまま残った。**カラムの型自由度(`question_type TEXT`)だけ残り、実際に使われる値のバリエーションは仕様として明文化されていない** |

---

## 3. PLANに無かったが実際に追加されたテーブル

**対象**: PLANの対象範囲(3テーブル)を超えて後から追加された3テーブル。

1. **`jev_country_keyword_labels` / `jev_country_keyword_evaluations`**(migration 0145、
   後日0146でデータ追加)— PLANはAI回答・質問文の評価のみを想定しており、「AI分類した
   キーワードがカタカナの国名だった場合の判定」という別ユースケースは影も無かった。
   `jev_evaluations`と対になる設計(ラベルマスター+評価結果テーブルの2枚組)を踏襲しつつ、
   主キーの単位を`share_id`ではなく`keyword`文字列に変えている点が設計上の工夫。
   ただし**この工夫自体はPLANの延長で自然に発見的に生まれたものであり、事前設計された
   ものではない**(テーブルカタログとしては後付けの継ぎ足しに見える)
2. **`jev_keyword_evaluation_locks`**(migration 0148)— 国名キーワード評価の一括実行で
   発生した多重実行の実運用問題への対処として、PLANには存在しない「一時ロック」テーブルが
   追加された。恒久データを持つ他5テーブルと性質が異なる(TTLで自然消滅する運用データ)ため、
   `SPEC.table-catalog-jev.md`のグループ分類上は同じ`ai`グループに含めているが、
   **本来は「マスターデータ」「評価結果」「排他制御用の一時データ」という3層に分けて
   カタログ化すべきだった**可能性がある

---

## 4. カタログドキュメント作成を通じて気づいた点

**対象**: `SPEC.table-catalog-jev.md`を実コードから書き起こす過程で判明した、
ドキュメントと実装の既存のズレ。

1. **`table_catalog`/`table_column_keys`自体がD1に投入されていない**。
   `SPEC.cloudflare-workers-github-oauth-1.table-catalog.md`(元ネタ)は
   これらをDB化する設計だったが、2026-09-19時点でも`src/index.ts`の定数
   (`STATUS_TABLE_DEFINITIONS`等)のままである。つまりJev版カタログも
   「DBに問い合わせれば分かる」ものではなく、今回のように**手動でコードを読んで
   書き起こすしかない**状態が1年近く続いている
2. **Jev系テーブルはすべて`TABLE_GROUP_MAP`上`group_name='ai'`に入っており、専用の
   `jev`サブグループが無い**。AIチャット本体(`ai_chat_shares`等、40テーブル近く)と
   同じ粒度で埋没しており、「Jev関連だけを一覧したい」という今回のような要求には
   コード上の一次情報から応えられない(だからこそ本SPEC/EVALのような手作業のカタログが
   価値を持つ)
3. **`jev_evaluations`と`jev_country_keyword_evaluations`は名前が酷似しているが
   一意性キーの構成要素がまったく異なる**(前者は`share_id`基準、後者は`keyword`
   文字列基準)。カタログ化して初めてこの非対称性が一望でき、事前にドキュメント化
   されていなければ取り違えるリスクが高いテーブルペアだと確認できた

---

## 5. 今後の推奨事項

**対象**: Jevテーブル群、および今後似たパターン(マスター+評価結果+排他制御)の
テーブル設計・カタログ化をする際の指針。

1. **新規テーブルのPLANには`user_id`によるテナント分離の要否を明示的なチェック項目として
   入れる**。今回`jev_evaluations`はPLAN段階で`user_id`列自体が抜けていた。この
   リポジトリのD1は全ユーザー共有インスタンスであるため、ユーザーごとに分離すべき
   データを持つテーブルの設計時は「このテーブルに`user_id`は要るか」を毎回明示的に
   自問する
2. **マスターデータ・評価結果・一時的な排他制御データは、`TABLE_GROUP_MAP`上でも
   区別できる粒度のグループ分けを検討する**。現状の`ai`という粗い1グループでは、
   `jev_keyword_evaluation_locks`のような「消えることが前提の運用データ」と
   `jev_labels`のような「恒久マスターデータ」が同列に並んでしまう
3. **`table_catalog`/`table_column_keys`のD1化(元のPLAN)は依然として未着手のまま**。
   Jev版カタログを含め、今後も機能追加のたびに手動でSPECファイルを書き起こす運用が
   続くなら、いっそ`STATUS_TABLE_DEFINITIONS`等の定数から自動でMarkdownカタログを
   生成するスクリプトを用意する方が、ドキュメントと実装のズレを防げる
4. **命名の揺れ(インデックス名の`_id`有無等)は些細に見えても、PLANとコードを
   突き合わせる後続作業のコストを上げる**。マイグレーションSQLをレビューする際は
   PLAN側で示した命名をできるだけ字面通り踏襲するか、変更する場合はコミット
   メッセージに理由を残す
