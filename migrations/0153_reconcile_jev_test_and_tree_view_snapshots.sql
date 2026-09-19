CREATE TABLE IF NOT EXISTS jev_test_label_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jev_test_label_groups_name ON jev_test_label_groups(name);

CREATE TABLE IF NOT EXISTS jev_test_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options_json TEXT,
  jev_group_id INTEGER NOT NULL REFERENCES jev_test_label_groups(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jev_test_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  model TEXT,
  jev_test_label_id INTEGER NOT NULL REFERENCES jev_test_labels(id),
  value REAL NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_jev_test_evaluations_unique ON jev_test_evaluations(user_id, target_id, model, jev_test_label_id);
CREATE INDEX IF NOT EXISTS idx_jev_test_evaluations_target ON jev_test_evaluations(target_id);

INSERT OR IGNORE INTO jev_test_label_groups (name) VALUES
  ('1.カバレッジ・網羅性'),
  ('2.正常系・異常系バランス'),
  ('3.モック・スタブの妥当性'),
  ('4.独立性・再現性'),
  ('5.アサーションの質'),
  ('6.命名・可読性'),
  ('7.回帰防止力'),
  ('8.実行コスト・保守性');

INSERT OR IGNORE INTO jev_test_labels (question_type, question_text, options_json, jev_group_id) VALUES
  ('score', 'T01 変更した行に対応するテストが1つも無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T02 追加した分岐(if/switch/三項演算子)のうち、テストされていない分岐がある', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T03 エラーコードやenumの新しい値がテストされていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T04 空文字列/空配列/null/undefinedといった境界値のテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T05 上限値・下限値・0件・1件・大量件数などの境界がテストされていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T06 非同期処理の成功パスしかテストされておらず失敗パスが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T07 新規追加した公開関数(export)に対応するテストファイルが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T08 削除・リネームした関数の参照元テストが更新されていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T09 型定義の変更に対して型エラーを検出するテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T10 複数ファイルにまたがる変更の統合テストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T11 UIコンポーネントの変更に対してレンダリング結果を検証するテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T12 DBスキーマ変更に対してマイグレーション後の読み書きを検証するテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '1.カバレッジ・網羅性')),
  ('score', 'T13 異常系(エラー・例外)のテストが1件も無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T14 タイムアウト・ネットワークエラー等の外部依存の失敗ケースがテストされていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T15 権限不足・未ログイン等の認可失敗ケースがテストされていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T16 不正な入力(型不一致・不正フォーマット)に対するテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T17 同時実行・競合状態のテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T18 リトライ・フォールバック処理の失敗パスがテストされていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T19 部分的失敗(一部成功一部失敗)のケースがテストされていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T20 例外を投げるべき箇所で例外が投げられることを確認していない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T21 エラーメッセージの内容そのものを検証していない(例外が飛ぶことだけ確認)', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T22 リソース枯渇(上限超過等)のケースがテストされていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T23 冪等性が必要な処理で冪等性を検証していない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T24 ロールバック処理のテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '2.正常系・異常系バランス')),
  ('score', 'T25 テスト対象の関数そのものをモックしてしまい実質何も検証していない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T26 モックの戻り値が本番のAPI/DBレスポンス形式と乖離している', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T27 モックが常に成功のみを返し失敗パターンをシミュレートしていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T28 外部APIをモックせず実際に本番/外部サービスへリクエストしている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T29 時刻・乱数をモックせず非決定的なテストになっている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T30 モックの呼び出し回数・引数を検証していない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T31 過度なモックでテストが内部実装に強く依存している(リファクタで壊れやすい)', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T32 本物のDB接続を使うべき箇所でモックに頼っている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T33 グローバル状態(環境変数等)をテストごとにリセットしていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T34 スパイ(spy)の後始末(restore)をしておらず他のテストに影響する', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '3.モック・スタブの妥当性')),
  ('score', 'T35 テストの実行順序に依存した結果になっている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T36 前のテストが残した状態(DB行・ファイル・グローバル変数)に依存している', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T37 並列実行で共有リソース(ポート・一時ファイル名)が衝突する', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T38 テストが外部ネットワークに依存しており、オフラインで失敗する', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T39 テストの成否が実行環境のタイムゾーンに依存している', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T40 テストの成否が実行環境のロケールに依存している', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T41 テスト内でsleepに依存したタイミング制御をしており不安定', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T42 CIでのみ再現し、ローカルでは再現しない差異がある', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T43 テストがランダムなテストデータを使い、失敗時に再現できない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T44 スナップショットテストが差分の意味を検証せず機械的に承認されている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '4.独立性・再現性')),
  ('score', 'T45 アサーションが1つも無い、または常に真になるアサーションのみ', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T46 toBeTruthy等の弱い検証のみで具体的な値を確認していない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T47 期待値がテスト対象コードの出力をそのままコピーしただけ', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T48 複数の検証観点を1つのexpectにまとめて失敗時にどこが壊れたか分からない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T49 配列やオブジェクトの一部プロパティしか検証せず余分な値の混入を検知できない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T50 エラーの型やコードを見ずメッセージ文字列の部分一致だけで判定している', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T51 非同期処理のawait漏れでテストが常に成功してしまう', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T52 例外が発生しなかったことを確認せず握りつぶしている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T53 HTTPステータスコードのみ検証しレスポンスボディを検証していない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T54 UIテストで表示文言のみ確認し実際の状態遷移を確認していない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '5.アサーションの質')),
  ('score', 'T55 テスト名が抽象的で何を保証しているか分からない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '6.命名・可読性')),
  ('score', 'T56 1つのit/testに複数の無関係な検証が混在している', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '6.命名・可読性')),
  ('score', 'T57 Arrange-Act-Assertの構造が崩れている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '6.命名・可読性')),
  ('score', 'T58 マジックナンバー・マジック文字列が説明なく使われている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '6.命名・可読性')),
  ('score', 'T59 テストのセットアップ処理が重複しコピペされている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '6.命名・可読性')),
  ('score', 'T60 テストが実装の詳細(内部変数名等)に依存した名前になっている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '6.命名・可読性')),
  ('score', 'T61 skip/todoのままのテストが放置されている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '6.命名・可読性')),
  ('score', 'T62 コメントアウトされたテストコードが残っている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '6.命名・可読性')),
  ('score', 'T63 このテストを削除しても既存のバグ検出力が変わらない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '7.回帰防止力')),
  ('score', 'T64 実装のロジックを1行変えてもテストが落ちない(over-mocking等)', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '7.回帰防止力')),
  ('score', 'T65 過去に実際に発生したバグに対する回帰テストが追加されていない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '7.回帰防止力')),
  ('score', 'T66 修正前は失敗し修正後に成功することを確認していない', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '7.回帰防止力')),
  ('score', 'T67 リファクタリング後にテストの意図が実装と乖離したまま放置されている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '7.回帰防止力')),
  ('score', 'T68 重大な障害シナリオ(データ消失・二重課金等)に対するテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '7.回帰防止力')),
  ('score', 'T69 セキュリティ上重要な認可チェックの欠落を検知できるテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '7.回帰防止力')),
  ('score', 'T70 パフォーマンス劣化(N+1等)を検知するテストが無い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '7.回帰防止力')),
  ('score', 'T71 不要に大きなデータセットを使いテスト実行が遅い', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '8.実行コスト・保守性')),
  ('score', 'T72 実際には不要なsleep/waitでテストが遅くなっている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '8.実行コスト・保守性')),
  ('score', 'T73 E2E/ブラウザテストで検証すべきでない内容をE2Eに寄せすぎている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '8.実行コスト・保守性')),
  ('score', 'T74 逆にユニットテストだけで実際の統合不具合を検知できない構成になっている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '8.実行コスト・保守性')),
  ('score', 'T75 CIタイムアウトに近い実行時間になっている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '8.実行コスト・保守性')),
  ('score', 'T76 テストファイルが肥大化し関係の薄いテストが混在している', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '8.実行コスト・保守性')),
  ('score', 'T77 テストのセットアップ/クリーンアップがリソースリークを起こしている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '8.実行コスト・保守性')),
  ('score', 'T78 依存パッケージのバージョン固定がテストの再現性を損なっている', '["問題なし(安全側)","問題あり(危険側)"]', (SELECT id FROM jev_test_label_groups WHERE name = '8.実行コスト・保守性'));

CREATE TABLE IF NOT EXISTS tree_view_snapshots (
  repo_name TEXT PRIMARY KEY,
  tree_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tree_view_snapshots_updated ON tree_view_snapshots(updated_at);

CREATE TABLE IF NOT EXISTS tree_view_snapshot_refresh_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  requested_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tree_view_snapshot_refresh_log_user ON tree_view_snapshot_refresh_log(user_id, requested_at);
