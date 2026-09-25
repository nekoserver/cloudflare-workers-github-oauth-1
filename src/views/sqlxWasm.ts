import { escapeHtml } from '../utils/html';
import { getThemeCSS, getThemeInitScript } from '../utils/theme';

const SAMPLE = JSON.stringify({
  table: 'users',
  columns: ['id', 'name'],
  rows: [[1, 'neko'], [2, 'saba']],
}, null, 2);

export function getSqlxWasmPage(username: string): string {
  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SQLx QueryBuilder (Rust/WASM)</title>${getThemeInitScript()}<style>
${getThemeCSS()} *{box-sizing:border-box} body{margin:0;font-family:system-ui,sans-serif;background:var(--bg-secondary);color:var(--text-primary)}
header{padding:18px 28px;background:var(--navbar-bg);display:flex;justify-content:space-between} main{max-width:1100px;margin:32px auto;padding:0 20px}
.card{background:var(--card-bg);border-radius:16px;padding:28px;box-shadow:0 10px 30px #0002}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
textarea,pre{width:100%;min-height:300px;margin:8px 0;padding:14px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-secondary);color:var(--text-primary);white-space:pre-wrap;overflow:auto}
button{padding:10px 18px;border:0;border-radius:8px;background:#667eea;color:white;font-weight:700;cursor:pointer}button:disabled{opacity:.5}.status{font-size:13px;color:var(--text-muted);margin:8px 0 18px}.note{line-height:1.7;color:var(--text-secondary)}
.options{margin:28px 0}.table-wrap{overflow-x:auto;border:1px solid var(--border-color);border-radius:8px}table{width:100%;border-collapse:collapse;min-width:620px}th,td{padding:12px 14px;text-align:left;border-bottom:1px solid var(--border-color);vertical-align:top;line-height:1.55}th{background:var(--bg-secondary)}tr:last-child td{border-bottom:0}.required{font-weight:700;color:#d97706}
@media(max-width:720px){.grid{grid-template-columns:1fr}.card{padding:18px}}
</style></head><body><header><b>🦀 SQLx QueryBuilder (Rust/WASM)</b><span>${escapeHtml(username)}</span></header>
<main><div class="card"><h1>SQLxをブラウザで使う</h1>
<p class="note">Rustの <code>sqlx::QueryBuilder&lt;Postgres&gt;</code> をWebAssemblyで実行し、値をSQLへ連結せずプレースホルダーを生成します。ブラウザにはDBソケットがないため、接続・実行はWorker側の責務です。</p>
<div id="status" class="status">WASMを読み込み中…</div><div class="grid"><section><label for="input"><b>入力JSON</b></label><textarea id="input">${escapeHtml(SAMPLE)}</textarea><button id="build" disabled>SQLを生成</button></section>
<section><b>SQLx出力</b><pre id="output" aria-live="polite">準備中…</pre></section></div>
<section class="options" aria-labelledby="options-heading"><h2 id="options-heading">入力オプション</h2>
<div class="table-wrap"><table><thead><tr><th scope="col">オプション</th><th scope="col">型</th><th scope="col">必須</th><th scope="col">説明</th><th scope="col">例</th></tr></thead><tbody>
<tr><td><code>table</code></td><td>文字列</td><td class="required">必須</td><td>INSERT先のテーブル名。英字または <code>_</code> で始まり、英数字と <code>_</code> のみ使用できます。</td><td><code>"users"</code></td></tr>
<tr><td><code>columns</code></td><td>文字列の配列</td><td class="required">必須</td><td>INSERTする列名。1件以上を指定し、各名前には <code>table</code> と同じ文字規則を適用します。</td><td><code>["id", "name"]</code></td></tr>
<tr><td><code>rows</code></td><td>値の二次元配列</td><td class="required">必須</td><td>挿入する行。1行以上を指定し、各行の値の数を <code>columns</code> の要素数と一致させます。</td><td><code>[[1, "neko"]]</code></td></tr>
</tbody></table></div></section></div></main>
<script type="module">
const status=document.getElementById('status'),button=document.getElementById('build'),input=document.getElementById('input'),output=document.getElementById('output');
let buildInsert;
async function run(){try{const result=buildInsert(input.value);if(result.startsWith('ERROR: ')){output.textContent=result;return}output.textContent=JSON.stringify(JSON.parse(result),null,2)}catch(error){output.textContent='ERROR: '+error.message}}
try{const wasm=await import('/wasm/sqlx.js');await wasm.default('/wasm/sqlx_bg.wasm');buildInsert=wasm.sqlx_build_insert;status.textContent='SQLx WASM 読み込み完了';button.disabled=false;run()}catch(error){status.textContent='WASMの読み込みに失敗しました: '+error.message;output.textContent=status.textContent}
button.addEventListener('click',run);input.addEventListener('input',run);
</script></body></html>`;
}
