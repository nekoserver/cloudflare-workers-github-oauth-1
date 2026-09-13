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

/**
 * `/api/cursor-agent/launch` が受け取るのは起動直後のCursor APIレスポンス
 * (agent.status=CREATING/RUNNING等の制御情報のみで、Agentが完了した後の
 * 実際の作業結果ではない)。それだけをD1に保存して終わりにすると、後から
 * 履歴を読み返しても永久に起動直後の状態しか見られない。GET /v1/agents/{id}を
 * 呼んで最新状態(完了後はstatus=FINISHED等になり、結果を含む)を取得し直す
 * URLを組み立てる。
 */
export function buildCursorAgentStatusUrl(agentId: string): string {
  return `https://api.cursor.com/v1/agents/${encodeURIComponent(agentId)}`;
}

/**
 * Cursor APIのレスポンス(POST /v1/agents・GET /v1/agents/{id}とも共通)から
 * agent_idを抽出する。実際のレスポンスはid・statusがトップレベルではなく
 * `agent`キーの下にネストされている(例: `{ agent: { id, status, ... }, run: {...} }`。
 * 2026-09-13にユーザーが実際に起動した結果で確認済み)。トップレベルの`id`は
 * 見ない(存在しない前提を信用しない。過去にトップレベルを見る誤った実装で
 * agent_idが常にnullのまま保存される不具合があった)。
 */
export function extractCursorAgentId(cursorResponse: unknown): string | null {
  if (!cursorResponse || typeof cursorResponse !== 'object') return null;
  const agent = (cursorResponse as { agent?: unknown }).agent;
  if (!agent || typeof agent !== 'object') return null;
  const id = (agent as { id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

function readNonEmptyStringField(obj: unknown, field: string): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const value = (obj as Record<string, unknown>)[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Cursor APIレスポンスからAgentが実際に生成したレポート本文らしきものを
 * 抜き出す。Cursor Agents APIが完了後の応答でどのフィールド名を使うのか
 * (専用の会話ログエンドポイントが別に存在するのかも含め)未確認のため、
 * 想定されるフィールド名を優先順位付きで探索し、最初に見つかった非空文字列を
 * 返す。1つも見つからなければnull(存在しないものをでっち上げない)。
 * 正式なフィールド名・エンドポイントが確認でき次第、この探索順を更新する。
 */
export function extractCursorAgentSummaryText(cursorResponse: unknown): string | null {
  if (!cursorResponse || typeof cursorResponse !== 'object') return null;
  const agent = (cursorResponse as { agent?: unknown }).agent;
  const run = (cursorResponse as { run?: unknown }).run;
  const candidates: Array<[unknown, string]> = [
    [agent, 'summary'],
    [agent, 'result'],
    [agent, 'output'],
    [agent, 'report'],
    [cursorResponse, 'summary'],
    [run, 'summary'],
  ];
  for (const [obj, field] of candidates) {
    const text = readNonEmptyStringField(obj, field);
    if (text) return text;
  }
  return null;
}
