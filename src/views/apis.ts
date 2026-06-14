export function getApisPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>API テスター</title>
<style>
:root{
  --bg:#f6f8fa;--surface:#fff;--border:#d0d7de;--text:#1f2328;--muted:#656d76;
  --link:#0969da;--radius:6px;
  --get:#1a7f37;--get-bg:#dafbe1;
  --post:#0969da;--post-bg:#ddf4ff;
  --put:#9a6700;--put-bg:#fff8c5;
  --delete:#cf222e;--delete-bg:#ffebe9;
  --patch:#6639ba;--patch-bg:#fbefff;
}
@media(prefers-color-scheme:dark){
  :root{--bg:#0d1117;--surface:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;
  --link:#58a6ff;--get:#3fb950;--get-bg:#0f2b18;--post:#58a6ff;--post-bg:#0c2d6b;
  --put:#e3b341;--put-bg:#2d1f00;--delete:#f85149;--delete-bg:#300a0a;
  --patch:#bc8cff;--patch-bg:#1d0f33;}
}
*{box-sizing:border-box;margin:0;padding:0;}
body{display:flex;height:100vh;overflow:hidden;background:var(--bg);color:var(--text);font:13px/1.5 system-ui,sans-serif;}
/* sidebar */
#sidebar{width:260px;min-width:260px;border-right:1px solid var(--border);overflow-y:auto;background:var(--surface);display:flex;flex-direction:column;}
#sidebar-search{padding:10px;border-bottom:1px solid var(--border);}
#sidebar-search input{width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:12px;}
.group-label{padding:6px 12px 4px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;cursor:pointer;display:flex;align-items:center;gap:4px;user-select:none;}
.group-label::before{content:'▾';font-size:10px;transition:transform .15s;}
.group-label.collapsed::before{transform:rotate(-90deg);}
.group-endpoints{overflow:hidden;}
.ep-item{display:flex;align-items:center;gap:6px;padding:5px 12px 5px 20px;cursor:pointer;border-left:3px solid transparent;}
.ep-item:hover{background:var(--bg);}
.ep-item.active{background:var(--bg);border-left-color:var(--link);}
.badge{font-size:10px;font-weight:700;padding:1px 5px;border-radius:3px;min-width:46px;text-align:center;flex-shrink:0;}
.badge-GET{background:var(--get-bg);color:var(--get);}
.badge-POST{background:var(--post-bg);color:var(--post);}
.badge-PUT{background:var(--put-bg);color:var(--put);}
.badge-DELETE{background:var(--delete-bg);color:var(--delete);}
.badge-PATCH{background:var(--patch-bg);color:var(--patch);}
.ep-path{font-size:11px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
/* main */
#main{flex:1;overflow-y:auto;display:flex;flex-direction:column;}
#welcome{display:flex;align-items:center;justify-content:center;flex:1;color:var(--muted);font-size:14px;}
#detail{display:none;flex-direction:column;flex:1;padding:24px;gap:16px;max-width:900px;width:100%;}
.ep-header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.ep-title{font-size:18px;font-weight:600;}
.ep-desc{color:var(--muted);font-size:13px;}
.section-title{font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;}
.param-table{width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;}
.param-table th{background:var(--bg);text-align:left;padding:6px 10px;border-bottom:1px solid var(--border);}
.param-table td{padding:5px 8px;border-bottom:1px solid var(--border);}
.param-table tr:last-child td{border-bottom:none;}
.param-table input,.param-table select{width:100%;padding:4px 7px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--text);font-size:12px;}
.req-badge{background:var(--delete-bg);color:var(--delete);font-size:10px;padding:1px 4px;border-radius:3px;font-weight:600;}
.body-area{font-family:monospace;font-size:12px;width:100%;min-height:140px;padding:8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);resize:vertical;}
.send-btn{background:var(--link);color:#fff;border:none;border-radius:var(--radius);padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;}
.send-btn:hover{opacity:.85;}
.send-btn:disabled{opacity:.5;cursor:not-allowed;}
.response-box{border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;}
.res-header{display:flex;align-items:center;gap:10px;padding:8px 14px;background:var(--bg);border-bottom:1px solid var(--border);font-size:12px;}
.status-ok{color:var(--get);font-weight:700;}
.status-err{color:var(--delete);font-weight:700;}
.res-body{font-family:monospace;font-size:12px;padding:12px;white-space:pre-wrap;word-break:break-all;max-height:400px;overflow-y:auto;background:var(--surface);}
</style>
</head>
<body>
<div id="sidebar">
  <div id="sidebar-search"><input id="search-input" placeholder="エンドポイントを検索…" oninput="filterEndpoints(this.value)"></div>
  <div id="groups"></div>
</div>
<div id="main">
  <div id="welcome">← エンドポイントを選択してください</div>
  <div id="detail">
    <div class="ep-header">
      <span class="badge" id="d-badge"></span>
      <span class="ep-title" id="d-path"></span>
    </div>
    <div class="ep-desc" id="d-desc"></div>
    <div id="path-params-sec" style="display:none">
      <div class="section-title">パスパラメータ</div>
      <table class="param-table"><thead><tr><th>名前</th><th>値</th></tr></thead><tbody id="path-params-body"></tbody></table>
    </div>
    <div id="query-params-sec" style="display:none">
      <div class="section-title">クエリパラメータ</div>
      <table class="param-table"><thead><tr><th>名前</th><th style="width:80px">必須</th><th>値</th></tr></thead><tbody id="query-params-body"></tbody></table>
    </div>
    <div id="body-sec" style="display:none">
      <div class="section-title">リクエストボディ (JSON)</div>
      <textarea class="body-area" id="body-area" spellcheck="false"></textarea>
    </div>
    <div><button class="send-btn" id="send-btn" onclick="sendRequest()">送信</button></div>
    <div id="response-sec" style="display:none">
      <div class="section-title">レスポンス</div>
      <div class="response-box">
        <div class="res-header">
          <span id="res-status"></span>
          <span id="res-time" style="color:var(--muted)"></span>
        </div>
        <div class="res-body" id="res-body"></div>
      </div>
    </div>
  </div>
</div>

<script>
const APIS = [
  { group: 'AI チャット', endpoints: [
    { method:'POST', path:'/api/aichat', desc:'AI にメッセージを送信', body:[{n:'message',req:true},{n:'model'},{n:'systemPromptMode'}] },
    { method:'GET',  path:'/api/aichat/shares/search', desc:'AIチャット全文検索', query:[{n:'q',req:true}] },
    { method:'GET',  path:'/api/aichat/shares/calendar', desc:'月別カレンダー', query:[{n:'month'}] },
    { method:'GET',  path:'/api/aichat/daily-stats', desc:'日別統計（キーワード・モデル）', query:[{n:'month'}] },
    { method:'GET',  path:'/api/aichat/shares/by-date', desc:'日付別共有一覧', query:[{n:'date',req:true}] },
    { method:'GET',  path:'/api/aichat/shares/by-keyword', desc:'キーワード一致共有一覧', query:[{n:'keyword',req:true}] },
    { method:'GET',  path:'/api/aichat/keywords/monthly', desc:'月別キーワード集計', query:[{n:'month'}] },
    { method:'GET',  path:'/api/aichat/search-log', desc:'検索ログ一覧' },
    { method:'GET',  path:'/api/aichat/search-history', desc:'検索履歴一覧' },
    { method:'GET',  path:'/api/aichat/search-keyword-analysis', desc:'キーワード分析' },
    { method:'POST', path:'/api/aichat/search-log/open-modal', desc:'検索ログモーダル準備', body:[{n:'keyword',req:true},{n:'shareIds',req:true}] },
    { method:'POST', path:'/api/aichat/search-log/approve', desc:'検索ログ承認登録', body:[{n:'keyword',req:true},{n:'shareIds',req:true}] },
    { method:'POST', path:'/api/aichat/search-log', desc:'検索ログ記録', body:[{n:'keyword',req:true},{n:'shareId',req:true},{n:'resultCount'}] },
    { method:'GET',  path:'/api/aichat/search-impressions', desc:'検索露出統計' },
    { method:'POST', path:'/api/aichat/search-impressions', desc:'検索露出記録', body:[{n:'shareIds',req:true},{n:'resultCount'}] },
    { method:'GET',  path:'/api/aichat/subqueries', desc:'サブクエリ一覧' },
    { method:'POST', path:'/api/aichat/subqueries', desc:'サブクエリ登録', body:[{n:'query',req:true}] },
    { method:'GET',  path:'/api/aichat/subquery-keyword-questions', desc:'サブクエリ×キーワード質問一覧', query:[{n:'subquery_id',req:true},{n:'keyword',req:true}] },
    { method:'GET',  path:'/api/aichat/share-subquery-links', desc:'質問のサブクエリリンク一覧', query:[{n:'question',req:true}] },
    { method:'GET',  path:'/api/aichat/share-subquery-links/all', desc:'全サブクエリリンク（質問別）' },
    { method:'POST', path:'/api/aichat/share-subquery-links', desc:'サブクエリリンク登録', body:[{n:'question',req:true},{n:'subquery_id',req:true},{n:'url'}] },
    { method:'GET',  path:'/api/aichat/share-keywords', desc:'共有のキーワード一覧', query:[{n:'shareId',req:true}] },
    { method:'GET',  path:'/api/aichat/shares-by-question', desc:'質問テキストで共有検索', query:[{n:'question',req:true}] },
    { method:'GET',  path:'/api/aichat/shares-by-question-hash', desc:'質問ハッシュで共有検索', query:[{n:'hash',req:true}] },
    { method:'GET',  path:'/api/aichat/all-keywords', desc:'全キーワード一覧（分類状況付き）' },
    { method:'GET',  path:'/api/aichat/keyword-categories', desc:'キーワードのカテゴリ一覧', query:[{n:'keyword'}] },
    { method:'POST', path:'/api/aichat/keyword-categories', desc:'カテゴリ新規作成', body:[{n:'name',req:true},{n:'color',req:true}] },
    { method:'POST', path:'/api/aichat/keyword-category-map', desc:'キーワードとカテゴリのマッピング保存', body:[{n:'keyword',req:true},{n:'category_ids',req:true}] },
    { method:'GET',  path:'/api/aichat/keyword-categories-summary', desc:'カテゴリ別キーワード数サマリ' },
    { method:'GET',  path:'/api/aichat/token-usage', desc:'トークン使用量統計', query:[{n:'months'}] },
    { method:'GET',  path:'/api/aichat/category-groups', desc:'カテゴリグループ一覧' },
    { method:'POST', path:'/api/aichat/category-groups', desc:'カテゴリグループ作成', body:[{n:'group_name',req:true},{n:'category_ids',req:true}] },
    { method:'POST', path:'/api/aichat/category-groups/:id/add-category', desc:'グループにカテゴリ追加', path_params:['id'], body:[{n:'category_id',req:true}] },
    { method:'POST', path:'/api/aichat/category-groups/:id/remove-category', desc:'グループからカテゴリ除去', path_params:['id'], body:[{n:'category_id',req:true}] },
    { method:'DELETE', path:'/api/aichat/category-groups/:id', desc:'カテゴリグループ削除', path_params:['id'] },
    { method:'GET',  path:'/api/aichat/shares/:id', desc:'共有詳細取得', path_params:['id'] },
    { method:'DELETE', path:'/api/aichat/shares/:id', desc:'共有を論理削除', path_params:['id'] },
    { method:'POST', path:'/api/aichat/share', desc:'共有リンク作成', body:[{n:'question',req:true},{n:'answer',req:true},{n:'model',req:true}] },
  ]},
  { group: 'AI サマリー', endpoints: [
    { method:'GET',  path:'/api/ai-summary/:id', desc:'AI サマリー詳細取得', path_params:['id'] },
    { method:'POST', path:'/api/ai-summary/:id/feedback', desc:'サマリーフィードバック投稿', path_params:['id'], body:[{n:'rating'},{n:'reviewer_type'},{n:'reviewer_name'},{n:'review_model'},{n:'comment'}] },
    { method:'POST', path:'/api/ai-summary/:id/resolve', desc:'解決ステータス更新', path_params:['id'], body:[{n:'resolved',req:true},{n:'resolution_note'}] },
  ]},
  { group: 'リポジトリ', endpoints: [
    { method:'POST', path:'/api/repositories', desc:'リポジトリ作成', body:[{n:'name',req:true},{n:'isPrivate'},{n:'description'}] },
    { method:'GET',  path:'/api/repositories/:owner/:repo/issues-count', desc:'オープンIssue数', path_params:['owner','repo'] },
    { method:'GET',  path:'/api/repositories/:owner/:repo/commits', desc:'最近のコミット一覧', path_params:['owner','repo'], query:[{n:'per_page'}] },
    { method:'GET',  path:'/api/repositories/:owner/:repo/commit-stats', desc:'コミット統計（著者別）', path_params:['owner','repo'], query:[{n:'period'}] },
    { method:'GET',  path:'/api/repositories/:owner/:repo/commit-months', desc:'コミット月一覧', path_params:['owner','repo'] },
    { method:'GET',  path:'/api/repositories/:owner/:repo/commits-by-month', desc:'月別コミット一覧', path_params:['owner','repo'], query:[{n:'period'}] },
    { method:'GET',  path:'/api/repositories/:owner/:repo/commits-calendar', desc:'月カレンダー（コミット数）', path_params:['owner','repo'], query:[{n:'year'},{n:'month'}] },
    { method:'GET',  path:'/api/repositories/:owner/:repo/commits-by-date', desc:'日付別コミット一覧', path_params:['owner','repo'], query:[{n:'date'}] },
    { method:'GET',  path:'/api/repositories/this-month-commits', desc:'今月コミットのあるリポジトリ' },
    { method:'GET',  path:'/api/repositories/search/commits', desc:'コミット全文検索', query:[{n:'q',req:true}] },
    { method:'GET',  path:'/api/repositories/search/keyword-classify-check', desc:'キーワード分類状況確認', query:[{n:'q',req:true}] },
    { method:'POST', path:'/api/repositories/search/keyword-label', desc:'キーワードラベル保存', body:[{n:'search_query',req:true},{n:'label',req:true}] },
    { method:'GET',  path:'/api/repositories/search/category-group', desc:'一致カテゴリグループ取得', query:[{n:'labels',req:true}] },
    { method:'GET',  path:'/api/repositories/search/category-groups', desc:'カテゴリグループ一覧' },
    { method:'GET',  path:'/api/repositories/search/category-group/check-name', desc:'グループ名存在確認', query:[{n:'name',req:true}] },
    { method:'POST', path:'/api/repositories/search/category-group', desc:'カテゴリグループ作成', body:[{n:'group_name',req:true},{n:'description'},{n:'categories',req:true}] },
    { method:'PUT',  path:'/api/repositories/search/category-group/:id', desc:'カテゴリグループ更新', path_params:['id'], body:[{n:'group_name'},{n:'description'},{n:'categories'}] },
    { method:'DELETE', path:'/api/repositories/search/category-group/:id', desc:'カテゴリグループ削除', path_params:['id'] },
    { method:'GET',  path:'/api/repositories/search/repo-keywords', desc:'リポジトリ別キーワード', query:[{n:'repo',req:true}] },
    { method:'GET',  path:'/api/repositories/search/repo-list', desc:'検索ヒットのあるリポジトリ一覧' },
    { method:'GET',  path:'/api/repositories/search/history', desc:'検索履歴一覧' },
    { method:'GET',  path:'/api/repositories/search/history/:id', desc:'検索履歴詳細', path_params:['id'] },
    { method:'GET',  path:'/api/repositories/search/keyword-stats', desc:'キーワード統計', query:[{n:'q',req:true},{n:'repo'}] },
    { method:'GET',  path:'/api/repositories/search/keyword-multi-labels', desc:'キーワードのマルチラベル', query:[{n:'q',req:true}] },
    { method:'POST', path:'/api/repositories/search/keyword-multi-labels', desc:'マルチラベル保存', body:[{n:'search_query',req:true},{n:'categories',req:true}] },
    { method:'GET',  path:'/api/repositories/search/keyword-multi-labels-all', desc:'全マルチラベル割り当て' },
    { method:'GET',  path:'/api/repo-permissions', desc:'インストール権限一覧' },
  ]},
  { group: 'リポジトリ色・グループ', endpoints: [
    { method:'GET',  path:'/api/repo-colors', desc:'リポジトリカラー設定一覧' },
    { method:'POST', path:'/api/repo-colors/sync', desc:'コミットキャッシュからカラー同期' },
    { method:'PATCH', path:'/api/repo-colors/:repoName', desc:'リポジトリカラー更新', path_params:['repoName'], body:[{n:'colorCode'},{n:'tags'},{n:'isVisible'},{n:'displayOrder'}] },
    { method:'GET',  path:'/api/repo-groups', desc:'リポジトリグループ一覧' },
    { method:'POST', path:'/api/repo-groups', desc:'リポジトリグループ作成', body:[{n:'name',req:true},{n:'description'},{n:'colorCode'},{n:'icon'},{n:'slackChannelId'},{n:'repos'}] },
    { method:'PATCH', path:'/api/repo-groups/:id', desc:'リポジトリグループ更新', path_params:['id'], body:[{n:'name'},{n:'description'},{n:'colorCode'},{n:'icon'},{n:'slackChannelId'},{n:'displayOrder'},{n:'repos'}] },
    { method:'DELETE', path:'/api/repo-groups/:id', desc:'リポジトリグループ削除', path_params:['id'] },
    { method:'GET',  path:'/api/repo-groups/:id/oauth-apps', desc:'グループの OAuth アプリ一覧', path_params:['id'] },
    { method:'POST', path:'/api/repo-groups/:id/oauth-apps', desc:'OAuth アプリ追加', path_params:['id'], body:[{n:'appName',req:true},{n:'appNote'}] },
    { method:'DELETE', path:'/api/repo-groups/:id/oauth-apps/:appName', desc:'OAuth アプリ削除', path_params:['id','appName'] },
    { method:'GET',  path:'/api/repo-oauth-apps', desc:'リポジトリ別 OAuth アプリ' },
  ]},
  { group: 'ステータス・スキーマ', endpoints: [
    { method:'GET',  path:'/api/status/schema', desc:'全テーブル定義・カラム・リレーション' },
    { method:'GET',  path:'/api/status/tables/:table/rows', desc:'テーブル行プレビュー', path_params:['table'] },
    { method:'GET',  path:'/api/status/tables/:table/ym-summary', desc:'年月別サマリ', path_params:['table'] },
    { method:'GET',  path:'/api/status/tables/:table/calendar', desc:'日別カレンダー', path_params:['table'], query:[{n:'ym'}] },
    { method:'GET',  path:'/api/status/tables/:table/migration-details', desc:'マイグレーション詳細', path_params:['table'] },
    { method:'GET',  path:'/api/status/tables/:table/group-er', desc:'テーブルグループ ER 図', path_params:['table'] },
    { method:'GET',  path:'/api/status/migrations/:migration/sql', desc:'マイグレーション SQL 取得', path_params:['migration'] },
    { method:'GET',  path:'/api/status/column-stats/verify', desc:'カラム FK 統計検証' },
    { method:'POST', path:'/api/status/fk-verify', desc:'FK サンプルデータ検証', body:[{n:'fromTable',req:true},{n:'fromCol',req:true},{n:'toTable',req:true},{n:'toCol',req:true}] },
  ]},
  { group: 'Cloudflare', endpoints: [
    { method:'GET',  path:'/api/cf-dashboard/d1', desc:'D1 データベース一覧' },
    { method:'GET',  path:'/api/cf-dashboard/d1/:dbId/tables', desc:'D1 テーブル行数一覧', path_params:['dbId'] },
    { method:'GET',  path:'/api/debug/d1', desc:'D1 接続診断' },
    { method:'GET',  path:'/api/debug/installations', desc:'GitHub App インストール診断' },
    { method:'GET',  path:'/api/cloudflare-setup-pending', desc:'セットアップ待ち通知一覧' },
    { method:'POST', path:'/api/cloudflare-setup-pending/:id/dismiss', desc:'通知を個別却下', path_params:['id'] },
    { method:'POST', path:'/api/cloudflare-setup-pending/dismiss-all', desc:'通知を一括却下' },
  ]},
  { group: 'プロフィール・設定', endpoints: [
    { method:'GET',  path:'/api/profile', desc:'ユーザープロフィール取得' },
    { method:'PUT',  path:'/api/profile', desc:'プロフィール更新', body:[{n:'name'}] },
    { method:'POST', path:'/api/settings/timezone', desc:'タイムゾーン設定', body:[{n:'timezone',req:true}] },
    { method:'POST', path:'/api/settings/session-duration', desc:'セッション期間設定', body:[{n:'sessionDuration',req:true}] },
    { method:'POST', path:'/api/settings/theme', desc:'テーマ設定', body:[{n:'theme',req:true}] },
    { method:'POST', path:'/api/settings/recent-commits-count', desc:'最近のコミット表示件数設定', body:[{n:'count',req:true}] },
    { method:'POST', path:'/api/settings/toast-duration', desc:'トースト表示時間設定', body:[{n:'duration',req:true}] },
    { method:'POST', path:'/api/settings/status-commit-cache-sort-mode', desc:'キャッシュソートモード設定', body:[{n:'mode',req:true}] },
    { method:'POST', path:'/api/settings/status-chart-mode', desc:'チャートモード設定', body:[{n:'mode',req:true}] },
    { method:'POST', path:'/api/settings/status-chart-sort-order', desc:'チャートソート順設定', body:[{n:'order',req:true}] },
    { method:'POST', path:'/api/settings/status-table-autodetect', desc:'テーブル自動検出設定', body:[{n:'mode',req:true}] },
    { method:'POST', path:'/api/settings/status-show-autodetected-tables', desc:'自動検出テーブル表示設定', body:[{n:'mode',req:true}] },
    { method:'POST', path:'/api/settings/status-ignore-unknown-unclassified-warning', desc:'未分類警告抑制設定', body:[{n:'mode',req:true}] },
    { method:'POST', path:'/api/settings/search-label-mode', desc:'検索ラベルモード設定', body:[{n:'mode',req:true}] },
  ]},
  { group: 'ワークスペース・関数', endpoints: [
    { method:'GET',  path:'/api/workspaces', desc:'ワークスペース一覧' },
    { method:'POST', path:'/api/workspaces/switch', desc:'ワークスペース切り替え', body:[{n:'workspaceId',req:true}] },
    { method:'GET',  path:'/api/function-file-history', desc:'関数ファイル変更履歴', query:[{n:'repo_id',req:true},{n:'function_name',req:true},{n:'file_path',req:true}] },
    { method:'GET',  path:'/api/function-source', desc:'関数ソースコード取得', query:[{n:'repo_id',req:true},{n:'function_name',req:true},{n:'file_path',req:true},{n:'max_lines'}] },
  ]},
  { group: 'その他', endpoints: [
    { method:'GET',  path:'/api', desc:'API 情報・ルート一覧' },
    { method:'GET',  path:'/api/public', desc:'認証不要テストエンドポイント' },
    { method:'GET',  path:'/api/protected', desc:'認証テストエンドポイント' },
  ]},
];

let currentEp = null;

function renderSidebar(filter='') {
  const fl = filter.toLowerCase();
  const container = document.getElementById('groups');
  container.innerHTML = '';
  APIS.forEach((g, gi) => {
    const filtered = g.endpoints.filter(ep =>
      !fl || ep.path.toLowerCase().includes(fl) || ep.method.toLowerCase().includes(fl) || ep.desc.toLowerCase().includes(fl)
    );
    if (!filtered.length) return;
    const label = document.createElement('div');
    label.className = 'group-label';
    label.textContent = g.group;
    label.onclick = () => { label.classList.toggle('collapsed'); eps.style.display = label.classList.contains('collapsed') ? 'none' : ''; };
    const eps = document.createElement('div');
    eps.className = 'group-endpoints';
    filtered.forEach((ep, ei) => {
      const item = document.createElement('div');
      item.className = 'ep-item';
      item.dataset.gi = gi;
      item.dataset.path = ep.path;
      item.dataset.method = ep.method;
      item.innerHTML = \`<span class="badge badge-\${ep.method}">\${ep.method}</span><span class="ep-path">\${esc(ep.path)}</span>\`;
      item.onclick = () => selectEndpoint(ep, item);
      eps.appendChild(item);
    });
    container.appendChild(label);
    container.appendChild(eps);
  });
}

function filterEndpoints(v) { renderSidebar(v); }

function selectEndpoint(ep, item) {
  document.querySelectorAll('.ep-item').forEach(el => el.classList.remove('active'));
  item.classList.add('active');
  currentEp = ep;
  document.getElementById('welcome').style.display = 'none';
  const d = document.getElementById('detail');
  d.style.display = 'flex';
  document.getElementById('d-badge').textContent = ep.method;
  document.getElementById('d-badge').className = 'badge badge-' + ep.method;
  document.getElementById('d-path').textContent = ep.path;
  document.getElementById('d-desc').textContent = ep.desc || '';
  document.getElementById('response-sec').style.display = 'none';

  const pathParams = ep.path_params || [];
  const pathSec = document.getElementById('path-params-sec');
  const pathBody = document.getElementById('path-params-body');
  if (pathParams.length) {
    pathBody.innerHTML = pathParams.map(p => \`<tr><td><code>:\${esc(p)}</code></td><td><input type="text" id="pp-\${esc(p)}" placeholder="\${esc(p)}"></td></tr>\`).join('');
    pathSec.style.display = '';
  } else { pathSec.style.display = 'none'; }

  const queryParams = ep.query || [];
  const qSec = document.getElementById('query-params-sec');
  const qBody = document.getElementById('query-params-body');
  if (queryParams.length) {
    qBody.innerHTML = queryParams.map(p => \`<tr><td><code>\${esc(p.n)}</code></td><td>\${p.req ? '<span class="req-badge">必須</span>' : ''}</td><td><input type="text" id="qp-\${esc(p.n)}" placeholder="\${esc(p.n)}"></td></tr>\`).join('');
    qSec.style.display = '';
  } else { qSec.style.display = 'none'; }

  const bodyFields = ep.body || [];
  const bSec = document.getElementById('body-sec');
  const bArea = document.getElementById('body-area');
  if (bodyFields.length) {
    const obj = {};
    bodyFields.forEach(f => { obj[f.n] = ''; });
    bArea.value = JSON.stringify(obj, null, 2);
    bSec.style.display = '';
  } else { bSec.style.display = 'none'; }
}

async function sendRequest() {
  if (!currentEp) return;
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.textContent = '送信中…';
  try {
    let path = currentEp.path;
    (currentEp.path_params || []).forEach(p => {
      const v = document.getElementById('pp-' + p)?.value ?? '';
      path = path.replace(':' + p, encodeURIComponent(v));
    });
    const qps = [];
    (currentEp.query || []).forEach(p => {
      const v = document.getElementById('qp-' + p.n)?.value ?? '';
      if (v) qps.push(encodeURIComponent(p.n) + '=' + encodeURIComponent(v));
    });
    if (qps.length) path += '?' + qps.join('&');

    const opts = { method: currentEp.method, headers: { 'Content-Type': 'application/json' } };
    if (['POST','PUT','PATCH','DELETE'].includes(currentEp.method) && currentEp.body?.length) {
      opts.body = document.getElementById('body-area').value;
    }

    const t0 = Date.now();
    const res = await fetch(path, opts);
    const elapsed = Date.now() - t0;
    const text = await res.text();
    let pretty = text;
    try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}

    const statusEl = document.getElementById('res-status');
    statusEl.textContent = res.status + ' ' + res.statusText;
    statusEl.className = res.ok ? 'status-ok' : 'status-err';
    document.getElementById('res-time').textContent = elapsed + ' ms';
    document.getElementById('res-body').textContent = pretty;
    document.getElementById('response-sec').style.display = '';
  } finally {
    btn.disabled = false;
    btn.textContent = '送信';
  }
}

function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

renderSidebar();
</script>
</body>
</html>`;
}
