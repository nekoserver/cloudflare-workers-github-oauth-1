/**
 * /cursor-agent ページ・POST /api/cursor-agent/launch 共通。
 * Cursor Background Agent API(POST https://api.cursor.com/v1/agents)を
 * フォーム入力から起動する前の入力チェックと、リクエストbodyの組み立てを行う。
 * ロジックはハンドラから切り出してテストする(CLAUDE.mdルール15)。
 */

/** 対象リポジトリのセレクトボックスに出す許可リスト。当面はこのリポジトリのみ */
export const CURSOR_AGENT_ALLOWED_REPOS = ['nekoserver/cloudflare-workers-github-oauth-1'] as const;

export type CursorAgentLaunchInput = {
  /** env.CURSOR_API_KEY が設定されているかどうか(生の値そのものはこの関数に渡さない) */
  hasApiKey: boolean;
  prompt: string;
  repoFullName: string;
  allowedRepos: readonly string[];
};

/**
 * エラー種別は判別可能な型(discriminated union)で表現する。文字列prefixで
 * 判定する設計は、判定漏れ・表示文言変更でのテスト破損を招くため使わない
 * (CLAUDE.mdルール32)。
 */
export type CursorAgentLaunchValidationErrorCode = 'missing_api_key' | 'prompt_too_short' | 'repo_not_allowed';

export type CursorAgentLaunchValidationResult =
  | { ok: true }
  | { ok: false; errorCode: CursorAgentLaunchValidationErrorCode };

/**
 * API KEY未設定・プロンプト1文字以下(空白のみ含む)・対象リポジトリが
 * 許可リストに無い、のいずれか1つでも欠けていれば実行させない。
 * 呼び出し元(POST /api/cursor-agent/launch)は、これがok:trueの場合のみ
 * 実際にCursor APIへリクエストしてよい。
 */
export function validateCursorAgentLaunchRequest(input: CursorAgentLaunchInput): CursorAgentLaunchValidationResult {
  if (!input.hasApiKey) {
    return { ok: false, errorCode: 'missing_api_key' };
  }
  if (input.prompt.trim().length <= 1) {
    return { ok: false, errorCode: 'prompt_too_short' };
  }
  if (!input.allowedRepos.includes(input.repoFullName)) {
    return { ok: false, errorCode: 'repo_not_allowed' };
  }
  return { ok: true };
}

/** 入力チェックエラーをユーザー向けの日本語メッセージに変換する(表示用の組み立てはこの1箇所のみ)。 */
export function formatCursorAgentValidationError(code: CursorAgentLaunchValidationErrorCode): string {
  switch (code) {
    case 'missing_api_key':
      return '❌ CURSOR_API_KEYが未設定のため実行できません(wrangler secret put CURSOR_API_KEYで設定してください)';
    case 'prompt_too_short':
      return '❌ プロンプトは2文字以上で入力してください';
    case 'repo_not_allowed':
      return '❌ 対象リポジトリを選択してください(実在しないリポジトリは実行できません)';
  }
}

export type CursorAgentRequestBody = {
  prompt: { text: string };
  model: { id: string; params: Array<{ id: string; value: string }> };
  repos: Array<{ url: string; startingRef: string }>;
};

/**
 * Cursor Agents APIのリクエストbodyを組み立てる。model/effort/fast/startingRefは
 * 固定値(呼び出し元のcurl例と同じ)。プロンプトはトリムしてから埋め込む。
 */
export function buildCursorAgentRequestBody(prompt: string, repoFullName: string): CursorAgentRequestBody {
  return {
    prompt: { text: prompt.trim() },
    model: {
      id: 'grok-4.6',
      params: [
        { id: 'effort', value: 'high' },
        { id: 'fast', value: 'true' },
      ],
    },
    repos: [
      {
        url: `https://github.com/${repoFullName}`,
        startingRef: 'main',
      },
    ],
  };
}
