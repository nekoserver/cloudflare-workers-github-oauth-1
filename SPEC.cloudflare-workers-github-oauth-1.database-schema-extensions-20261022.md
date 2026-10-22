# DB拡張と欠落スキーマの補完

更新日: 2026-10-22 UTC。対象: 本番D1 `workers-github-oauth`（`abbe590b-f7ff-4b98-b61c-17c8cb18c8cf`）。

## 目的と確認結果

複数コンテナ集計の拡張に加え、移行SQLに定義されているが本番DBに存在しなかったテーブル・列・インデックス・トリガーを整理する。2026-10-22 21:00:53 UTCに本番の `sqlite_master` を再取得し、先に提示した欠落補完SQLに対応する3テーブル・12インデックス・4トリガー・4列がすべて存在し、DDLも一致することを確認した。取得対象のオブジェクト数は437から456になった（列はこの件数に含めない）。照合処理は読み取りのみであり、適用の実行者・日時は確認していない。

## 複数コンテナの集計基盤

0186は既存操作ログにコンテナ識別子・表示名・当時の時間単価・計算根拠JSONを追加し、操作単位の作業メモ改訂を保存する。0187はコンテナ台帳、稼働区間、イベント、任意の対象、作業分類・目的・手段・成果・根拠、費用改訂、ファイルシステムの定義と観測を分離する。

対象未入力でも集計できる。同日利用と同時稼働、実費と概算、不明とゼロ、作業分類と使用ツールを区別する。日時の正本はUTC、日別集計は日本時間。識別不能な過去ログを推測で補完しない。見込み売上・費用配分・ROIは今回の範囲外。

0187の全32オブジェクトは本番に存在し、DDL一致を確認済み。詳細な制約・集計規則・残作業は [複数コンテナ統計SPEC](SPEC.cloudflare-workers-github-oauth-1.multi-container-statistics.md) を正本とする。DDLの適用だけでは新台帳への自動記録や画面表示の完成を意味しない。

## 補完したテーブル

| 移行 | テーブル | 保存内容・制約 |
|---|---|---|
| 0086 | `aichat_category_audit_log` | ユーザー、操作、対象種別・ID・名称、詳細、記録日時。カテゴリ操作の監査情報を保存する受け皿 |
| 0148 | `jev_keyword_evaluation_locks` | ユーザー・キーワードを複合主キーとし、ロック取得日時を保存する受け皿 |
| 0186 | `cf_container_session_notes` | 開始操作への外部キー、正の改訂番号、最大8,000文字の本文、記録者・日時。開始操作と改訂番号を一意にする |

監査ログの自動記録、ロックの取得・期限切れ回収・解放、メモのAPI接続が機能するかは今回の照合では確認していない。これらのテーブルにはUPDATE/DELETEを禁止するトリガーはなく、存在だけで改ざん防止や追記専用を保証しない。

## 補完したインデックス

| 移行 | インデックス | 対象列 |
|---|---|---|
| 0011 | `idx_commit_search_history_user_id` | `commit_search_history(user_id)` |
| 0011 | `idx_commit_search_history_total_hits` | `commit_search_history(user_id, total_hits DESC)` |
| 0011 | `idx_commit_search_repo_stats_history_id` | `commit_search_repo_stats(search_history_id)` |
| 0066 | `idx_hqvl_user_heritage_qm` | `heritage_question_view_log(user_id, heritage_name, question_master_id)` |
| 0074 | `idx_ai_chat_shares_deleted_at` | `ai_chat_shares(deleted_at)` |
| 0085 | `idx_aichat_keyword_category_map_category` | `aichat_keyword_category_map(category_id)` |
| 0086 | `idx_aichat_category_audit_log_user_created` | `aichat_category_audit_log(user_id, created_at DESC)` |
| 0086 | `idx_aichat_category_audit_log_entity` | `aichat_category_audit_log(entity_type, entity_id)` |
| 0129 | `idx_d1_query_catalog_query_name` | `d1_query_catalog(query_name)` |
| 0171 | `idx_clef_evaluations_unique` | `clef_evaluations(target_type, user_id, share_id, model, jev_label_id, clef_model)`、UNIQUE |
| 0171 | `idx_clef_evaluations_share` | `clef_evaluations(share_id)` |
| 0186 | `idx_container_operation_identity_time` | `cf_container_operation_log(container_key, created_at, id)` |

索引は検索経路を支援するが、性能改善量・クエリプランは未測定。CLEFの一意索引ではSQLiteのNULLの扱いに従い、NULLを含む組まで同一として排除する保証はない。

## 初出台帳への自動記録（0167）

次のAFTER INSERTトリガーを補完した。挿入と同じトランザクションで `aichat_keyword_registry` に初出を追加し、`(user_id, keyword)` の競合時は `DO NOTHING` で既存情報を保持する。

| トリガー | 挿入元 | 初出日時の元 | first_source |
|---|---|---|---|
| `aichat_keyword_registry_from_answer` | `aichat_answer_keyword_vectors` | `computed_at` | `answer_extraction` |
| `aichat_keyword_registry_from_search` | `aichat_search_log` | `first_searched_at` | `search` |
| `aichat_keyword_registry_from_embedding` | `aichat_keyword_embeddings` | `created_at` | `embedding` |
| `aichat_keyword_registry_from_classification` | `aichat_keyword_category_map` | `created_at` | `classification` |

回答由来では同じユーザーの共有回答が存在する場合のみ `first_share_id` に設定し、その他はNULL。これらは新規INSERT時に作用し、既存行のUPDATEや過去データの自動再走査には作用しない。記録済みの初出は保持され、後から古い日時の行を投入しても最小日時へ更新しない。

0167の過去データをlegacyとして取り込むINSERTは、今回提示した欠落補完SQLには含めていない。過去分が網羅されているかは未確認であり、トリガー追加によってバックフィル済みとは扱わない。

## 照合から除外したもの

- 0005・0006の旧インデックスは後続移行で削除されるため復活させない。
- 0154の `d1_query_catalog_0154_new` は移行用の一時テーブルで、リネーム後に残らないことを欠落と扱わない。
- 0084のカテゴリ一意索引と0085のカテゴリ関連一意索引は別名の同等索引が存在するため重複追加しない。
- 0187は既に存在していたため、今回の欠落補完SQLには含めない。

## 適用・検証・復元の境界

0186の4つのADD COLUMNは再実行不可。以後の差分適用も実スキーマを先に確認する。移行履歴テーブルがないため、オブジェクトの存在を過去の移行ファイル全体の実行証明としない。データ更新・投入SQLの実行履歴や全テーブルの制約差分までは判定していない。

提示前には取得した本番DDLを空のSQLiteへ再現し、補完SQLが通ることを確認した。適用後の本番再照合では追加対象すべての存在とDDL一致を確認した。本番データへの書き込みテスト、トリガー発火の実測、性能試験は行っていない。

スキーマの再構築元は各 `migrations/*.sql`。監査・メモ・費用・イベントの履歴データはDDLから復元できないため、削除や再作成を復旧手段にしない。今回の欠落補完は過去の欠落記録を復元するものではなく、データ復旧・バックアップからの復元試験は未実施。
