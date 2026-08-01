#!/usr/bin/env node
'use strict';

/**
 * .claude/harness-hook-log-fallback.jsonl（harness_hook_logへの書き込みに
 * 失敗した際のローカルフォールバック）を読み込み、集計してHTMLレポートを
 * .claude/harness-hook-log-report.html へ書き出す。
 *
 * .claude/ 以下はgitignore対象のためこのレポート自体も自動コミットはされない。
 * 中身を確認した上で必要ならユーザー/エージェントが手動でcommitする運用を想定している
 * （harness_hook_logへの書き込みが失敗し続ける環境でも記録を失わないための緩和策）。
 *
 * 使い方:
 *   node scripts/render-harness-hook-log-report.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FALLBACK_LOG_PATH = path.join(ROOT, '.claude', 'harness-hook-log-fallback.jsonl');
const REPORT_PATH = path.join(ROOT, '.claude', 'harness-hook-log-report.html');

function readEntries(fallbackPath) {
  if (!fs.existsSync(fallbackPath)) return [];
  const raw = fs.readFileSync(fallbackPath, 'utf-8');
  const entries = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      entries.push({ checkName: '(不正な行)', result: 'error', detail: trimmed.slice(0, 200), loggedAt: null });
    }
  }
  return entries;
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#39;');
}

function summarize(entries) {
  const byResult = {};
  const byCheck = {};
  for (const e of entries) {
    const r = e.result || '(unknown)';
    const c = e.checkName || '(unknown)';
    byResult[r] = (byResult[r] || 0) + 1;
    byCheck[c] = (byCheck[c] || 0) + 1;
  }
  return { total: entries.length, byResult, byCheck };
}

function renderCountTable(counts) {
  const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (keys.length === 0) return '<p class="muted">データなし</p>';
  let html = '<table><thead><tr><th>項目</th><th>件数</th></tr></thead><tbody>';
  for (const k of keys) {
    html += '<tr><td>' + escapeHtml(k) + '</td><td>' + counts[k] + '</td></tr>';
  }
  html += '</tbody></table>';
  return html;
}

function resultBadgeClass(result) {
  if (result === 'ok') return 'badge-ok';
  if (result === 'ng') return 'badge-ng';
  return 'badge-error';
}

function renderEntryRows(entries) {
  const sorted = entries.slice().sort((a, b) => String(b.loggedAt || '').localeCompare(String(a.loggedAt || '')));
  if (sorted.length === 0) {
    return '<tr><td colspan="6" class="muted">記録がありません（harness_hook_logへの書き込みが成功しているか、まだフックが一度も失敗していません）</td></tr>';
  }
  return sorted.map(function (e) {
    return '<tr>'
      + '<td class="mono">' + escapeHtml(e.loggedAt || '-') + '</td>'
      + '<td>' + escapeHtml(e.checkName || '-') + '</td>'
      + '<td><span class="badge ' + resultBadgeClass(e.result) + '">' + escapeHtml(e.result || '-') + '</span></td>'
      + '<td>' + escapeHtml(e.toolName || '-') + '</td>'
      + '<td class="mono">' + escapeHtml(e.filePath || '-') + '</td>'
      + '<td>' + escapeHtml(e.detail || '-') + '</td>'
      + '</tr>';
  }).join('');
}

function renderHtml(entries) {
  const summary = summarize(entries);
  const generatedAt = new Date().toISOString();
  return '<!doctype html>\n'
    + '<html lang="ja"><head><meta charset="utf-8">'
    + '<title>Harness Hook Log レポート（ローカルフォールバック）</title>'
    + '<style>\n'
    + ':root{color-scheme:light dark;}\n'
    + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:24px;'
    + 'background:#f7f8fa;color:#1a202c;}\n'
    + '@media (prefers-color-scheme: dark){body{background:#0f1420;color:#e6edf3;}}\n'
    + 'h1{font-size:20px;margin-bottom:4px;}\n'
    + '.muted{color:#718096;font-size:13px;}\n'
    + '.notice{background:#fff8c5;border:1px solid #d4a72c;border-radius:8px;padding:10px 14px;'
    + 'font-size:13px;margin:16px 0;}\n'
    + '@media (prefers-color-scheme: dark){.notice{background:#3a2f00;border-color:#8a6d00;}}\n'
    + '.summary-row{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0;}\n'
    + '.summary-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;min-width:180px;}\n'
    + '@media (prefers-color-scheme: dark){.summary-card{background:#161c2c;border-color:#2d3748;}}\n'
    + '.summary-card h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#718096;margin:0 0 8px;}\n'
    + 'table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;}\n'
    + 'th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0;}\n'
    + '@media (prefers-color-scheme: dark){th,td{border-color:#2d3748;}}\n'
    + 'th{font-size:11px;text-transform:uppercase;color:#718096;}\n'
    + '.mono{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all;}\n'
    + '.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;}\n'
    + '.badge-ok{background:#c6f6d5;color:#22543d;}\n'
    + '.badge-ng{background:#fed7d7;color:#822727;}\n'
    + '.badge-error{background:#feebc8;color:#7b341e;}\n'
    + '.table-wrap{overflow-x:auto;}\n'
    + '</style></head><body>\n'
    + '<h1>Harness Hook Log レポート（ローカルフォールバック集計）</h1>\n'
    + '<p class="muted">生成日時(UTC): ' + escapeHtml(generatedAt) + ' / 集計元: .claude/harness-hook-log-fallback.jsonl</p>\n'
    + '<div class="notice">このレポートは harness_hook_log（本来の記録先）への書き込みに失敗した際のローカル'
    + 'フォールバックを集計したものです。.claude/ 以下はgitignore対象のため自動ではコミットされません。'
    + '内容を確認した上で必要であれば手動でcommitしてください。</div>\n'
    + '<div class="summary-row">\n'
    + '<div class="summary-card"><h2>総件数</h2>' + summary.total + '</div>\n'
    + '<div class="summary-card"><h2>結果別</h2>' + renderCountTable(summary.byResult) + '</div>\n'
    + '<div class="summary-card"><h2>チェック別</h2>' + renderCountTable(summary.byCheck) + '</div>\n'
    + '</div>\n'
    + '<div class="table-wrap"><table><thead><tr>'
    + '<th>記録日時</th><th>チェック名</th><th>結果</th><th>ツール</th><th>ファイル</th><th>詳細</th>'
    + '</tr></thead><tbody>\n' + renderEntryRows(entries) + '\n</tbody></table></div>\n'
    + '</body></html>\n';
}

function main() {
  const entries = readEntries(FALLBACK_LOG_PATH);
  const html = renderHtml(entries);
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, html, 'utf-8');
  process.stdout.write('書き出しました: ' + REPORT_PATH + ' (' + entries.length + '件)\n');
}

module.exports = { readEntries, summarize, renderHtml };

if (require.main === module) {
  main();
}
