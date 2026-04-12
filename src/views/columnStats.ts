/**
 * カラム名別リレーション統計 HTML ビュー
 *
 * /status/column-stats で表示される。ER 図の矢印数と「同名カラムが何テーブルに出現するか」を
 * 比較し、論理的に期待される最小リレーション数に届いていないカラム名を可視化する。
 *
 * 用途:
 * - どのカラム名が最も多くのテーブルで共有されているかを一覧化
 * - そのうち ER 図の矢印数が不足しているものをハイライト
 * - 「カラム名 × 出現テーブル数 × 期待矢印数 × 実際の矢印数 × 差分」をマトリクスで表示
 */

import type { ColumnStat } from '../utils/columnRelationStats';

export interface ColumnStatsViewInput {
  stats: ColumnStat[];
  totalTables: number;
  totalRelations: number;
  generatedAt: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderColumnStatsHtml(input: ColumnStatsViewInput): string {
  const { stats, totalTables, totalRelations, generatedAt } = input;

  // 2テーブル以上に出現するカラムのみ表示
  const multiTable = stats.filter((s) => s.tableCount >= 2);
  const missingCount = multiTable.filter((s) => s.missing > 0).length;

  const rows = multiTable
    .map((s) => {
      const rowClass = s.missing > 0 ? 'row-missing' : 'row-ok';
      const badgeClass = s.missing > 0 ? 'badge-missing' : 'badge-ok';
      const badgeText = s.missing > 0 ? '不足' : 'OK';
      const tablesText = s.tables.map(escapeHtml).join(', ');
      return `<tr class="${rowClass}">
        <td class="col-name"><code>${escapeHtml(s.columnName)}</code></td>
        <td class="col-count">${s.tableCount}</td>
        <td class="col-expected">${s.expectedRelations}</td>
        <td class="col-actual">${s.actualRelations}</td>
        <td class="col-missing"><span class="badge ${badgeClass}">${badgeText}${s.missing > 0 ? ` (${s.missing})` : ''}</span></td>
        <td class="col-tables">${tablesText}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>カラム名別リレーション統計 — /status/column-stats</title>
  <style>
    :root {
      --bg: #0d1117;
      --panel: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --text-primary: #f0f6fc;
      --accent: #58a6ff;
      --danger: #f85149;
      --success: #3fb950;
      --warn: #d29922;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px;
      background: var(--bg); color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
    }
    h1 { color: var(--text-primary); margin: 0 0 8px; font-size: 22px; }
    .subtitle { color: var(--text-muted); font-size: 13px; margin-bottom: 20px; }
    .summary {
      display: flex; gap: 16px; flex-wrap: wrap;
      background: var(--panel); border: 1px solid var(--border);
      padding: 16px; border-radius: 8px; margin-bottom: 20px;
    }
    .summary-item { flex: 1; min-width: 160px; }
    .summary-label { color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-value { color: var(--text-primary); font-size: 24px; font-weight: 700; margin-top: 4px; }
    .summary-value.danger { color: var(--danger); }
    .summary-value.success { color: var(--success); }
    .help {
      background: var(--panel); border: 1px solid var(--border);
      padding: 14px 16px; border-radius: 8px; margin-bottom: 20px;
      font-size: 12px; color: var(--text-muted);
    }
    .help strong { color: var(--text-primary); }
    table {
      width: 100%; border-collapse: collapse;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 8px; overflow: hidden;
    }
    th {
      background: #1c2128; color: var(--text-muted);
      text-align: left; padding: 10px 12px;
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 10px 12px; border-bottom: 1px solid var(--border);
      font-size: 13px; vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }
    tr.row-missing td { background: rgba(248, 81, 73, 0.06); }
    code {
      background: #0d1117; padding: 2px 6px; border-radius: 4px;
      font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px;
      color: var(--text-primary);
    }
    .col-name { width: 200px; }
    .col-count, .col-expected, .col-actual { text-align: right; width: 100px; font-variant-numeric: tabular-nums; }
    .col-missing { width: 120px; }
    .col-tables { color: var(--text-muted); font-size: 12px; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 600;
    }
    .badge-ok { background: rgba(63, 185, 80, 0.2); color: var(--success); }
    .badge-missing { background: rgba(248, 81, 73, 0.2); color: var(--danger); }
    .footer {
      margin-top: 20px; padding-top: 16px;
      border-top: 1px solid var(--border);
      color: var(--text-muted); font-size: 11px;
    }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <h1>カラム名別リレーション統計</h1>
  <div class="subtitle">
    「同じカラム名が複数テーブルに出現する ＝ 論理的に相関がある」前提で、
    ER 図に引かれている矢印の本数と期待値を比較します。
    不足 (missing) があれば ER 図の論理FK 設定 (<code>COLUMN_FK_TARGETS</code>) が漏れている可能性があります。
  </div>

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">テーブル総数</div>
      <div class="summary-value">${totalTables}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">リレーション総数</div>
      <div class="summary-value">${totalRelations}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">共有カラム（2テーブル以上）</div>
      <div class="summary-value">${multiTable.length}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">矢印不足のカラム</div>
      <div class="summary-value ${missingCount > 0 ? 'danger' : 'success'}">${missingCount}</div>
    </div>
  </div>

  <div class="help">
    <strong>読み方</strong>:
    「期待」= <code>テーブル数 − 1</code> （最小全域木として必要な矢印の本数）。
    「実際」= ER 図 (<code>/api/status/schema</code>) に登録されているリレーションのうち
    そのカラム名を使うものの本数（from 側を基準に集計）。
    <br>
    <strong>補足</strong>:
    <code>id</code>, <code>created_at</code> など全テーブル共通の技術カラムもリストに含まれるが、
    実質的に相関を持たないため不足 (missing) でも実装上の問題にはならない。
    注視すべきは <code>repo_name</code>, <code>workspace_id</code>, <code>user_id</code> 等のドメインカラム。
  </div>

  <table>
    <thead>
      <tr>
        <th>カラム名</th>
        <th class="col-count">テーブル数</th>
        <th class="col-expected">期待</th>
        <th class="col-actual">実際</th>
        <th>状態</th>
        <th>出現テーブル</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center; color:var(--text-muted)">共有カラムなし</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    生成時刻: ${escapeHtml(generatedAt)}<br>
    関連: <a href="/status">/status</a> &nbsp;/&nbsp; <a href="/api/status/schema">/api/status/schema</a>
  </div>
</body>
</html>`;
}
