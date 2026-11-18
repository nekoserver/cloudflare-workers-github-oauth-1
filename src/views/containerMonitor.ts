import { getThemeCSS, getThemeInitScript } from '../utils/theme';
export function getContainerMonitorPage(): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>コンテナ監視</title>${getThemeInitScript()}
<style>${getThemeCSS()}*{box-sizing:border-box}body{margin:0;background:var(--bg-primary);color:var(--text-primary);font:15px/1.6 system-ui,sans-serif}main{max-width:1440px;margin:auto;padding:28px 20px}a{color:var(--accent-color)}h1{font-size:26px;margin:16px 0 6px}.controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:20px 0}button,select,input{font:inherit;padding:8px 12px;border:1px solid var(--border-color);border-radius:7px;background:var(--card-bg);color:inherit}button{cursor:pointer}button:disabled{opacity:.6}.panel{padding:16px;background:var(--card-bg);border:1px solid var(--border-color);border-radius:10px;margin:16px 0}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px;border-bottom:1px solid var(--border-color);vertical-align:top;overflow-wrap:anywhere}th{white-space:nowrap}small,.muted{color:var(--text-muted)}#monitor-status{min-height:28px}label{white-space:nowrap}[hidden]{display:none!important}</style></head><body><main>
<nav><a href="/">ホーム</a> · <a href="/cf-containers">コンテナ管理</a></nav>
<h1>コンテナ監視</h1><p class="muted">取得方式を選び、稼働状態とネットワーク上の接続状態を確認します。</p>
<div class="controls"><label>取得方式 <select id="monitor-provider" aria-label="取得方式"></select></label><button id="monitor-refresh">更新</button><label><input id="monitor-auto" type="checkbox" checked>30秒ごとに更新</label><input id="monitor-filter" type="search" placeholder="名前・IPで絞り込み" aria-label="一覧の絞り込み"><span id="monitor-count">0件</span></div>
<div id="monitor-wasm-controls" class="panel" hidden><button id="monitor-connect">Tailscaleへ接続</button> <button id="monitor-disconnect">ログアウト</button><p id="monitor-login"></p><small>Tailscaleへログインしたブラウザから見える端末を表示します。CloudflareのAPIトークンは不要です。</small></div>
<p id="monitor-scope" class="muted"></p><p id="monitor-status" role="status">取得方式を確認中…</p>
<div class="panel table-wrap"><table><thead><tr><th>名前</th><th>アプリケーション</th><th>状態</th><th>アドレス</th><th>最終確認</th><th>詳細</th></tr></thead><tbody id="monitor-targets"></tbody></table></div>
<p class="muted">Cloudflare APIはコンテナの実行状態、Tailscaleは端末の接続情報を表示します。取得範囲は選んだ方式の権限に従います。</p>
<script type="module" src="/container-monitor.mjs"></script></main></body></html>`;
}
