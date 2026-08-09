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


export function formatAiToolLimitInfo(now: Date): string {
  const checkedAt = formatJstDateTime(now);
  return [
    '## Codex / Claude Code リミット確認',
    `確認時刻(JST): ${checkedAt}`,
    '',
    '### Codex (ChatGPT)',
    '- 5時間枠: ローカルメッセージとクラウドタスクで共有されます。',
    '- 週次枠: プランにより追加の週次リミットが適用される場合があります。',
    '- 実際の残量: Codex の使用量ページまたは画面上のリミット表示で確認してください。',
    '- 公式情報: https://chatgpt.com/codex/pricing/ / https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan',
    '',
    '### Claude Code',
    '- 5時間枠: Settings > Usage で5時間セッションの消費状況を確認できます。',
    '- 週次枠: 同じ Usage 画面で週次使用量の進捗バーを確認できます。',
    '- CLI: Claude Code では `/usage` で現在の使用状況を確認できます。',
    '- 公式情報: https://support.claude.com/en/articles/9797557-usage-limit-best-practices',
    '',
    '※ この `/neko limit` は外部アカウントへログインせず、公開情報と確認先を表示します。あなたの実残量は各サービスのログイン済み画面で確認してください。',
  ].join('\n');
}

/**
 * `/neko help` 用に有効なサブコマンドと簡単な説明をMarkdownテーブルで返す。
 * 罫線・ツリー文字は使わずMarkdownテーブルで表現する（CLAUDE.mdルール16）。
 */
export function formatAichatSlashCommandHelp(): string {
  return [
    '## /neko サブコマンド一覧',
    '| コマンド | 説明 |',
    '|---|---|',
    '| /neko hms | 現在時刻(JST)を表示します |',
    '| /neko cal | 当月カレンダーをMarkdownテーブルで表示します |',
    '| /neko clog | 直近のコミットエージェントログを表示します |',
    '| /neko limit | Codex / Claude Code のリミット確認先を表示します |',
    '| /neko search <キーワード> | 質問文・回答文にキーワードを含む過去ログのヒット件数を表示します |',
    '| /neko vcount | ベクタ化済みの回答文の件数を表示します |',
    '| /neko help | このサブコマンド一覧を表示します |',
  ].join('\n');
}

export type CommitAgentLogRow = {
  commit_sha: string | null;
  commit_message: string | null;
  detected_agent_name: string | null;
  created_at: string;
};

/**
 * commit_agent_log の最新行をMarkdownのコードブロックで表示する。
 * データが無い場合はその旨を返す（空文字やnullを返して握りつぶさない）。
 */
export function formatCommitAgentLogEntry(row: CommitAgentLogRow | null): string {
  if (!row) {
    return 'commit_agent_log に記録がありません';
  }
  const firstLine = (row.commit_message ?? '').split('\n')[0] || '(コミットメッセージなし)';
  const lines = [
    `sha: ${row.commit_sha ?? '(なし)'}`,
    `message: ${firstLine}`,
    `agent: ${row.detected_agent_name ?? '(未検出)'}`,
    `created_at: ${row.created_at}`,
  ];
  return ['```', ...lines, '```'].join('\n');
}

/**
 * `/neko search <キーワード>` の検索結果を、質問文・回答文にキーワードを
 * 含む過去ログのヒット件数のみで表示する(一覧は表示しない)。
 */
export function formatAichatSearchResults(keyword: string, hitCount: number): string {
  if (!keyword) {
    return '❌ キーワードを指定してください: /neko search <キーワード>';
  }
  return `「${keyword}」を質問文・回答文に含む過去ログ: ${hitCount}件`;
}

/**
 * `/neko vcount` で表示する、ベクタ化済み(aichat_answer_vectors)の
 * 回答文の件数(user_idごと、share_id単位で重複なし)。
 */
export function formatVectorizedAnswerCount(count: number): string {
  return `ベクタ化済みの回答文: ${count}件`;
}

export type AichatSlashCommandDeps = {
  fetchLatestCommitAgentLog: () => Promise<CommitAgentLogRow | null>;
  countSharesMatchingKeyword?: (keyword: string) => Promise<number>;
  countVectorizedAnswers?: () => Promise<number>;
};

export const AICHAT_SEARCH_TIMEOUT_MS = 8000;

type RaceOutcome<T> =
  | { status: 'ok'; value: T }
  | { status: 'timeout' }
  | { status: 'error'; message: string };

/**
 * DB問い合わせ(countSharesMatchingKeyword/countVectorizedAnswers等)が
 * データ量等の理由で長時間応答しない場合に、応答バブルが「考え中...」の
 * まま無期限に固まって見える(ユーザーからは「AIに問い合わせに行ったまま
 * ハングアップする」ように見える)ことを防ぐため、一定時間で必ず打ち切って
 * 結果を返す。DB呼び出し自体の例外も同様に捕捉し、握りつぶさずエラーとして
 * 返す(CLAUDE.mdルール8)。
 */
async function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<RaceOutcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<RaceOutcome<T>>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'timeout' }), ms);
  });
  const settled = promise
    .then((value): RaceOutcome<T> => ({ status: 'ok', value }))
    .catch((err): RaceOutcome<T> => ({ status: 'error', message: err instanceof Error ? err.message : String(err) }));
  const result = await Promise.race([settled, timeoutPromise]);
  if (timer !== undefined) clearTimeout(timer);
  return result;
}

export type AichatSlashCommandResult =
  | { handled: true; response: string }
  | { handled: false };

/**
 * AIチャットの入力欄に打たれたメッセージが `/neko` コマンドかどうかを判定し、
 * 該当すればAIモデルを呼ばずにローカルで完結する応答を返す。
 * `/neko` で始まらないメッセージは通常のAI問い合わせに委ねる（handled: false）。
 */
export async function interpretAichatSlashCommand(
  message: string,
  now: Date,
  deps: AichatSlashCommandDeps
): Promise<AichatSlashCommandResult> {
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

  if (subcommand === 'clog') {
    const row = await deps.fetchLatestCommitAgentLog();
    return { handled: true, response: formatCommitAgentLogEntry(row) };
  }

  if (subcommand === 'limit') {
    return { handled: true, response: formatAiToolLimitInfo(now) };
  }

  if (subcommand === 'search') {
    const keyword = parts.slice(2).join(' ').trim();
    if (!keyword || !deps.countSharesMatchingKeyword) {
      return { handled: true, response: formatAichatSearchResults(keyword, 0) };
    }
    const outcome = await raceWithTimeout(deps.countSharesMatchingKeyword(keyword), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko search がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)。データ量が多い可能性があります。時間をおいて再度お試しください。`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko search でエラーが発生しました: ${outcome.message}` };
    }
    return { handled: true, response: formatAichatSearchResults(keyword, outcome.value) };
  }

  if (subcommand === 'vcount') {
    if (!deps.countVectorizedAnswers) {
      return { handled: true, response: formatVectorizedAnswerCount(0) };
    }
    const outcome = await raceWithTimeout(deps.countVectorizedAnswers(), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko vcount がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)。データ量が多い可能性があります。時間をおいて再度お試しください。`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko vcount でエラーが発生しました: ${outcome.message}` };
    }
    return { handled: true, response: formatVectorizedAnswerCount(outcome.value) };
  }

  if (subcommand === 'help') {
    return { handled: true, response: formatAichatSlashCommandHelp() };
  }

  return {
    handled: true,
    response: `❌ 未対応のサブコマンドです: ${subcommand || '(なし)'}\n利用可能なコマンド: /neko hms, /neko cal, /neko clog, /neko limit, /neko search, /neko vcount, /neko help\n詳細は /neko help を実行してください`,
  };
}
