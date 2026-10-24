import type { BuildLogAnalysis } from '../utils/moonbitBuildLog';

export interface MoonbitSampleCase {
  title: string;
  description: string;
  log: string;
  result: BuildLogAnalysis;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!);
}

export function getMoonbitSamplePage(cases: MoonbitSampleCase[]): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MoonBit サンプル | 本体Worker</title>
<style>
:root{color-scheme:light dark;--bg:#f6f8fa;--panel:#fff;--text:#1f2328;--muted:#59636e;--border:#d0d7de;--code:#f0f2f4;--link:#0969da;font:15px/1.65 system-ui,sans-serif}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--panel:#161b22;--text:#e6edf3;--muted:#9da7b3;--border:#30363d;--code:#21262d;--link:#79c0ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text)}header{position:sticky;top:0;background:var(--panel);border-bottom:1px solid var(--border);padding:12px max(16px,calc((100vw - 1100px)/2));display:flex;align-items:center;gap:16px;z-index:1}header a{color:var(--link);text-decoration:none}h1{font-size:18px;margin:0}.page{max-width:1100px;margin:auto;padding:24px 16px}section{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:18px;margin:18px 0}h2{font-size:16px;margin:0 0 8px}p{margin:8px 0;color:var(--muted)}.flow{font-family:ui-monospace,monospace;color:var(--text);overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--code);border:1px solid var(--border);border-radius:8px;padding:14px;margin:8px 0 0;font:12px/1.6 ui-monospace,monospace}.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:760px){.cols{grid-template-columns:1fr}}
</style></head><body>
<header><h1>MoonBit サンプル</h1><a href="/cf-containers/planner">ビルド実測履歴</a></header>
<main class="page">
<section><h2>本体Workerでの実行経路</h2>
<p>このページを表示するたび、Worker内で生成済みMoonBitコードを実行し、BuildKit形式のログを解析しています。</p>
<p class="flow">moonbit/buildlog/buildlog.mbt → src/generated/moonbit/buildlog.js → src/utils/moonbitBuildLog.ts → このページ</p>
<p>MoonBitはステップ番号・処理名・状態・所要秒数を抽出します。キャッシュ・失敗・未完了は秒数を作らず、不明のまま返します。</p></section>
${cases.map((sample) => `<section><h2>${escapeHtml(sample.title)}</h2><p>${escapeHtml(sample.description)}</p>
<div class="cols"><div><strong>入力ログ</strong><pre>${escapeHtml(sample.log)}</pre></div>
<div><strong>MoonBitの解析結果</strong><pre>${escapeHtml(JSON.stringify(sample.result, null, 2))}</pre></div></div></section>`).join('')}
</main></body></html>`;
}
