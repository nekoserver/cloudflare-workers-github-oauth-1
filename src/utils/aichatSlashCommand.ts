const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

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
    return { handled: true, response: `🕐 現在時刻（JST）: ${formatJstDateTime(now)}` };
  }

  return {
    handled: true,
    response: `❌ 未対応のサブコマンドです: ${subcommand || '(なし)'}\n利用可能なコマンド: /neko hms`,
  };
}
