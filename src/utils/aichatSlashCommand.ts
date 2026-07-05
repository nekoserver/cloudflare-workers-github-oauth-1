const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getJstDateParts(now: Date): { year: number; month: number; day: number } {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1, day: jst.getUTCDate() };
}

export function formatJstDateTime(now: Date): string {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = jst.getUTCFullYear();
  const mo = pad(jst.getUTCMonth() + 1);
  const d = pad(jst.getUTCDate());
  const h = pad(jst.getUTCHours());
  const mi = pad(jst.getUTCMinutes());
  const s = pad(jst.getUTCSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * JST(UTC+9)の当月カレンダーをMarkdownテーブルで組み立てる。今日のマスは太字にする。
 * 罫線・ツリー文字は使わずMarkdownテーブルで表現する（CLAUDE.mdルール16）。
 */
export function formatJstMonthCalendar(now: Date): string {
  const { year, month, day } = getJstDateParts(now);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const header = '| 日 | 月 | 火 | 水 | 木 | 金 | 土 |';
  const separator = '|---|---|---|---|---|---|---|';
  const rows: string[] = [];
  let cells: string[] = new Array(firstWeekday).fill('');
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d === day ? `**${d}**` : String(d));
    if (cells.length === 7) {
      rows.push('| ' + cells.join(' | ') + ' |');
      cells = [];
    }
  }
  if (cells.length > 0) {
    while (cells.length < 7) cells.push('');
    rows.push('| ' + cells.join(' | ') + ' |');
  }

  return [`${year}年${month}月`, header, separator, ...rows].join('\n');
}

export type AichatSlashCommandResult =
  | { handled: true; response: string }
  | { handled: false };

/**
 * AIチャットの入力欄に打たれたメッセージが `/neko` コマンドかどうかを判定し、
 * 該当すればAIモデルを呼ばずにローカルで完結する応答を返す。
 * `/neko` で始まらないメッセージは通常のAI問い合わせに委ねる（handled: false）。
 */
export function interpretAichatSlashCommand(message: string, now: Date): AichatSlashCommandResult {
  const trimmed = message.trim();
  if (!trimmed.toLowerCase().startsWith('/neko')) {
    return { handled: false };
  }

  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
  const subcommand = (parts[1] ?? '').toLowerCase();

  if (subcommand === 'hms') {
    return { handled: true, response: formatJstDateTime(now) };
  }

  if (subcommand === 'cal') {
    return { handled: true, response: formatJstMonthCalendar(now) };
  }

  return {
    handled: true,
    response: `❌ 未対応のサブコマンドです: ${subcommand || '(なし)'}\n利用可能なコマンド: /neko hms, /neko cal`,
  };
}
