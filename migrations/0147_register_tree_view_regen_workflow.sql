INSERT INTO workflow_registry (workflow_no, title, page_path, summary)
SELECT printf('%04d', COALESCE(MAX(CAST(workflow_no AS INTEGER)), 0) + 1),
  'tree viewのJSONデータ更新(/neko tree→dynamicneko)',
  '/aichat',
  'AIチャットの/neko treeスラッシュコマンドの整形ロジックを使ってdynamicnekoのtree-viewページが読むJSONスナップショットを再生成し、コミット・テスト・PR作成までを示します。'
FROM workflow_registry;

INSERT INTO workflow_steps (workflow_no, step_order, stage_title, api_method, api_path, note, indent_level)
SELECT workflow_no, 1, '対象リポジトリのファイル一覧を取得', NULL, NULL, 'git ls-tree -r HEADで対象リポジトリ(既定はnekoserver/cloudflare-workers-github-oauth-1)のパス一覧(path\ttype)を取得します。/neko treeはGitHub APIのツリーAPIから同じ形式の一覧を取得します。更新対象は現在実在するリポジトリのみに限定し、テンプレートから新たに作成されたインスタンスであっても自動的には対象に含めない。対象を広げる場合は都度リポジトリを明示的に指定すること。', 0
FROM workflow_registry ORDER BY CAST(workflow_no AS INTEGER) DESC LIMIT 1;

INSERT INTO workflow_steps (workflow_no, step_order, stage_title, api_method, api_path, note, indent_level)
SELECT workflow_no, 2, 'AIチャットで/neko treeを実行', 'POST', '/api/aichat', '/neko tree <owner/repo> --depth 4のようにスラッシュコマンドを送信し、隠しファイル除外・4階層・名前順ソートで整形されたMarkdown箇条書きのツリーを得ます。', 1
FROM workflow_registry ORDER BY CAST(workflow_no AS INTEGER) DESC LIMIT 1;

INSERT INTO workflow_steps (workflow_no, step_order, stage_title, api_method, api_path, note, indent_level)
SELECT workflow_no, 3, '同じ整形ロジックをローカルでも再現(手順1の一覧を使う場合)', NULL, NULL, 'src/utils/treeWasmServer.tsのformatTreeViaWasm()にTSV形式の一覧を直接渡すと、/neko treeと同一の整形結果を得られます。GitHub API呼び出しを避けたい場合に使います。', 1
FROM workflow_registry ORDER BY CAST(workflow_no AS INTEGER) DESC LIMIT 1;

INSERT INTO workflow_steps (workflow_no, step_order, stage_title, api_method, api_path, note, indent_level)
SELECT workflow_no, 4, 'ツリー整形結果をTreeViewNodeのJSON構造に変換', NULL, NULL, 'Markdownの箇条書き(- name/でディレクトリ、- nameでファイル)をインデント階層ごとに解析し、{name, type, children}のJSONへ変換します。', 0
FROM workflow_registry ORDER BY CAST(workflow_no AS INTEGER) DESC LIMIT 1;

INSERT INTO workflow_steps (workflow_no, step_order, stage_title, api_method, api_path, note, indent_level)
SELECT workflow_no, 5, 'dynamicneko側のsrc/data/tree-view-sample-data.tsを置き換え', NULL, NULL, 'TREE_VIEW_SAMPLE_DATAの値を新しいJSONに差し替えます。TREE_VIEW_SAMPLE_ROOT_LABELやヘッダーコメントの生成元説明も併せて更新します。', 0
FROM workflow_registry ORDER BY CAST(workflow_no AS INTEGER) DESC LIMIT 1;

INSERT INTO workflow_steps (workflow_no, step_order, stage_title, api_method, api_path, note, indent_level)
SELECT workflow_no, 6, 'dynamicneko側でtype-checkとテストを実行', NULL, NULL, 'npm run type-checkでtsc --noEmitを実行し、test/tree-view-page.browser.test.tsxをCHROME_PATH=/opt/pw-browsers/chromium付きで実行して確認します。このテストはTREE_VIEW_SAMPLE_DATAから期待値を動的に導出するため、ファイル名を決め打ちしていません。', 1
FROM workflow_registry ORDER BY CAST(workflow_no AS INTEGER) DESC LIMIT 1;

INSERT INTO workflow_steps (workflow_no, step_order, stage_title, api_method, api_path, note, indent_level)
SELECT workflow_no, 7, '新しいブランチへコミットしてドラフトPRを作成', NULL, NULL, 'dynamicneko側で新しいブランチにコミット・pushし、ドラフトPRを作成します。マージ済みブランチへ気づかずpushしないよう、着手前に対象ブランチのPRがマージ済みでないか確認します。', 0
FROM workflow_registry ORDER BY CAST(workflow_no AS INTEGER) DESC LIMIT 1;
