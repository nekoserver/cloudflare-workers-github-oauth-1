/** 表示・保存用の質問本文。送信するコマンドは呼び出し元で保持する。 */
export function formatCodexAskgkQuestion(message: string): string {
  const match = message.match(/^\s*\/neko\s+askgk\s+codex_prompt\s*=\s*["“”]([\s\S]*)["“”]\s*$/i);
  return match ? match[1] : message;
}

/** Codex/Claude/Museコマンドの質問本文。中継する入力は引用符ごと保持する。 */
export function formatAskgkPromptQuestion(message: string): string {
  const match = message.match(/^\s*\/neko\s+askgk\s+(?:codex|claude|muse)_prompt\s*=\s*["“”]([\s\S]*)["“”]\s*$/i);
  return match ? match[1] : message;
}

/** 完全一致でのみ認める既存のコマンド別名。 */
const ASKGK_SLASH_ALIASES: Record<string, string> = { './usage': '/usage' };

/** エージェント制御入力を通常のAI回答履歴から除外する。 */
export function isAskgkSlashPrompt(question: string): boolean {
  const match = question.match(/^\w+_(?:prompt|prmpt)\s*=\s*([\s\S]*)$/i);
  if (!match) return false;
  let prompt = match[1].trim();
  const quoted = (prompt.startsWith('"') && prompt.endsWith('"')) ||
    (prompt.startsWith('“') && prompt.endsWith('”'));
  if (quoted) {
    prompt = prompt.slice(1, -1);
    if (!/%(?![0-9a-f]{2})/i.test(prompt)) {
      try { prompt = decodeURIComponent(prompt.replace(/\+/g, ' ')); }
      catch { /* 不正なUTF-8は元の入力で判定する。 */ }
    }
  }
  const command = prompt.trim();
  return (ASKGK_SLASH_ALIASES[command.toLowerCase()] ?? command).startsWith('/');
}
