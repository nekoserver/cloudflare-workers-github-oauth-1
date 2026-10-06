/** 表示・保存用の質問本文。送信するコマンドは呼び出し元で保持する。 */
export function formatCodexAskgkQuestion(message: string): string {
  const match = message.match(/^\s*\/neko\s+askgk\s+codex_prompt\s*=\s*["“”]([\s\S]*)["“”]\s*$/i);
  return match ? match[1] : message;
}
