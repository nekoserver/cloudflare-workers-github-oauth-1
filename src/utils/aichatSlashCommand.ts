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
    '| /neko search <キーワード> | 質問文・回答文にキーワードを含む過去ログのヒット件数を表示します(結果一覧は最大30件までモーダルで確認できます) |',
    '| /neko vcount | ベクタ化済みの回答文の件数と全回答文に占める割合を表示します(結果一覧は最大30件までモーダルで確認できます) |',
    '| /neko 256 <文字列> | 指定した文字列のSHA-256ハッシュをWASM(Rust実装)で計算します |',
    '| /neko factor <数値> | 指定した整数(0以上2^53以下)をWASM(Rust実装)で素因数分解します |',
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

// チャット画面を長い一覧で埋め尽くさないための暫定措置として、検索結果
// 一覧はチャット本文に直接書き出さず、最上位レイヤーのモーダルで最大30件
// まで確認できるようにする(応答バブルにはヒット件数とモーダルを開く
// リンクだけを表示する)。
export type AichatResultItem = {
  id: string;
  question: string;
};

export type AichatSearchOutcome = {
  hitCount: number;
  results: AichatResultItem[];
};

/**
 * `/neko search <キーワード>` の検索結果を、質問文・回答文にキーワードを
 * 含む過去ログのヒット件数のみで表示する(一覧はチャット本文には出さない。
 * 一覧を開くリンクはinterpretAichatSlashCommandの戻り値resultsForModalを
 * 使ってUI側で埋め込む)。
 */
export function formatAichatSearchResults(keyword: string, outcome: AichatSearchOutcome): string {
  if (!keyword) {
    return '❌ キーワードを指定してください: /neko search <キーワード>';
  }
  return `「${keyword}」を質問文・回答文に含む過去ログ: ${outcome.hitCount}件`;
}

export type AichatVectorizedAnswersOutcome = {
  count: number;
  totalCount: number;
  results: AichatResultItem[];
};

/**
 * `/neko vcount` で表示する、ベクタ化済み(aichat_answer_vectors)の
 * 回答文の件数(user_idごと、share_id単位で重複なし)を、行末に
 * 「/総回答数　(〇%)」の形で全回答文に占める割合を添えて表示する
 * (一覧はチャット本文には出さない。/neko searchと同様、一覧を開く
 * リンクはresultsForModalを使ってUI側で埋め込む)。総回答数が0件の
 * 場合は0除算を避け、割合の表示自体を省略する。
 */
export function formatVectorizedAnswerCount(count: number, totalCount: number): string {
  if (totalCount <= 0) {
    return `ベクタ化済みの回答文: ${count}件`;
  }
  const percent = Math.round((count / totalCount) * 100);
  return `ベクタ化済みの回答文: ${count}件 / ${totalCount}件　(${percent}%)`;
}

/**
 * `/neko 256 <文字列>` の計算結果を表示する。入力にバッククォート等が
 * 含まれても崩れないよう、コードブロックではなく1行のプレーンテキストで
 * 組み立てる(バッククォートで囲むと入力自体にバッククォートが含まれる場合に
 * Markdownが崩れるため)。
 */
export function formatSha256WasmResult(input: string, hex: string): string {
  return ['## SHA-256 (WASM)', `入力: ${input}`, `ハッシュ: ${hex}`].join('\n');
}

/**
 * `/neko factor <数値>` の計算結果を表示する。resultはGNU coreutilsの
 * factorコマンドと同じ書式("n: p1 p2 p3 ...")で渡される。
 */
export function formatFactorWasmResult(result: string): string {
  return ['## factor (WASM)', '```', result, '```'].join('\n');
}

export type AichatSlashCommandDeps = {
  fetchLatestCommitAgentLog: () => Promise<CommitAgentLogRow | null>;
  searchShares?: (keyword: string) => Promise<AichatSearchOutcome>;
  vectorizedAnswers?: () => Promise<AichatVectorizedAnswersOutcome>;
  sha256ViaWasm?: (input: string) => Promise<string>;
  factorViaWasm?: (n: number) => Promise<string>;
};

export const AICHAT_SEARCH_TIMEOUT_MS = 8000;

type RaceOutcome<T> =
  | { status: 'ok'; value: T }
  | { status: 'timeout' }
  | { status: 'error'; message: string };

/**
 * DB問い合わせ(searchShares/vectorizedAnswers等)が
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
  | { handled: true; response: string; resultsForModal?: AichatResultItem[] }
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
    if (!keyword || !deps.searchShares) {
      return { handled: true, response: formatAichatSearchResults(keyword, { hitCount: 0, results: [] }) };
    }
    const outcome = await raceWithTimeout(deps.searchShares(keyword), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko search がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)。データ量が多い可能性があります。時間をおいて再度お試しください。`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko search でエラーが発生しました: ${outcome.message}` };
    }
    return {
      handled: true,
      response: formatAichatSearchResults(keyword, outcome.value),
      resultsForModal: outcome.value.results.length > 0 ? outcome.value.results : undefined,
    };
  }

  if (subcommand === 'vcount') {
    if (!deps.vectorizedAnswers) {
      return { handled: true, response: formatVectorizedAnswerCount(0, 0) };
    }
    const outcome = await raceWithTimeout(deps.vectorizedAnswers(), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko vcount がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)。データ量が多い可能性があります。時間をおいて再度お試しください。`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko vcount でエラーが発生しました: ${outcome.message}` };
    }
    return {
      handled: true,
      response: formatVectorizedAnswerCount(outcome.value.count, outcome.value.totalCount),
      resultsForModal: outcome.value.results.length > 0 ? outcome.value.results : undefined,
    };
  }

  if (subcommand === '256') {
    const target = parts.slice(2).join(' ').trim();
    if (!target) {
      return { handled: true, response: '❌ ハッシュ化する文字列を指定してください: /neko 256 <文字列>' };
    }
    if (!deps.sha256ViaWasm) {
      return { handled: true, response: '❌ /neko 256 は現在利用できません(WASM未設定)' };
    }
    try {
      const hex = await deps.sha256ViaWasm(target);
      return { handled: true, response: formatSha256WasmResult(target, hex) };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko 256 の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'factor') {
    const raw = (parts[2] ?? '').trim();
    const MAX_SAFE = 9007199254740992; // 2^53
    if (!raw) {
      return { handled: true, response: '❌ 素因数分解する整数を指定してください: /neko factor <数値>' };
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MAX_SAFE) {
      return { handled: true, response: `❌ nは0以上${MAX_SAFE}(2^53)以下の整数を指定してください: /neko factor <数値>` };
    }
    if (!deps.factorViaWasm) {
      return { handled: true, response: '❌ /neko factor は現在利用できません(WASM未設定)' };
    }
    try {
      const result = await deps.factorViaWasm(n);
      return { handled: true, response: formatFactorWasmResult(result) };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko factor の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'help') {
    return { handled: true, response: formatAichatSlashCommandHelp() };
  }

  return {
    handled: true,
    response: `❌ 未対応のサブコマンドです: ${subcommand || '(なし)'}\n利用可能なコマンド: /neko hms, /neko cal, /neko clog, /neko limit, /neko search, /neko vcount, /neko 256, /neko factor, /neko help\n詳細は /neko help を実行してください`,
  };
}
