function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function nestedField(payload: Record<string, unknown>, objectKey: string, fieldKey: string): string | null {
  const obj = payload[objectKey];
  if (!obj || typeof obj !== 'object') return null;
  return nonEmptyString((obj as Record<string, unknown>)[fieldKey]);
}

/**
 * cf-auth webhook のペイロードから判定対象のユーザー名を抽出する。
 * まずトップレベルのusername > user > login > emailの優先順で探し、
 * どれも無ければGitHubリポジトリのpush webhookの形(pusher.name > sender.login)
 * もフォールバックとして見る(dynamicnekoのpush通知はGitHubネイティブの
 * webhookペイロードをそのまま転送しているため、これらのキーしか持たない)。
 */
export function extractCfAuthUsername(payload: Record<string, unknown>): string | null {
  const topLevelCandidates = ['username', 'user', 'login', 'email'];
  for (const key of topLevelCandidates) {
    const value = nonEmptyString(payload[key]);
    if (value) return value;
  }
  return nestedField(payload, 'pusher', 'name') ?? nestedField(payload, 'sender', 'login');
}
