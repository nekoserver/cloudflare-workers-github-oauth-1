import { MLB_DIVISIONS } from './mlbDivisions';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function getJstDateParts(now: Date): { year: number; month: number; day: number } {
  const jst = new Date(now.getTime() + JST_OFFSET_MS);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1, day: jst.getUTCDate() };
}

/** JST(UTC+9)における「今日」をYYYY-MM-DD形式で返す。/neko mlb のMLBスケジュール取得日に使う。 */
export function getJstDateYmdHyphen(now: Date): string {
  const { year, month, day } = getJstDateParts(now);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

/** DateをUnixエポックからの経過秒数に変換する。 */
export function formatEpochTime(now: Date): string {
  return String(Math.floor(now.getTime() / 1000));
}

function ymdOf(d: Date): string {
  return (
    String(d.getUTCFullYear()).padStart(4, '0') +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

/**
 * JSTの今日から`days`日後まで(両端含む、古い順)のYYYYMMDD候補を列挙する。
 * `/neko fymd`・`/neko factor -a`の素数判定は、JS側の独自実装(旧isPrimeInteger)
 * ではなく、factor-wasm(Rust実装)の`is_prime`へ一本化した
 * (2つの素数判定実装が食い違うリスクを避けるため)。この関数自体は
 * 日付候補の列挙だけを担い、素数判定は呼び出し側がWASM経由で行う。
 */
export function buildYmdCandidates(now: Date, days: number): string[] {
  const { year, month, day } = getJstDateParts(now);
  const start = new Date(Date.UTC(year, month - 1, day));
  const result: string[] = [];
  for (let i = 0; i <= days; i++) {
    const c = new Date(start);
    c.setUTCDate(c.getUTCDate() + i);
    result.push(ymdOf(c));
  }
  return result;
}

/** `/neko factor -a <日数>`の結果を、日付昇順のMarkdownテーブルで表示する。 */
export function formatPrimeYmdSearchResult(days: number, primeYmds: string[]): string {
  if (primeYmds.length === 0) {
    return `## 素数日検索(今日から${days}日以内)\n該当する素数日はありませんでした`;
  }
  return [
    `## 素数日検索(今日から${days}日以内)`,
    '| YYYYMMDD |',
    '|---|',
    ...primeYmds.map((ymd) => `| ${ymd} |`),
  ].join('\n');
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
  const separator = '|---:|---:|---:|---:|---:|---:|---:|';
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

  const title = `| ${year}年${month}月 |`;
  const titleSeparator = '|:---:|';

  return [title, titleSeparator, header, separator, ...rows].join('\n');
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
    '| /neko epoch | 現在のエポックタイム(秒)を表示します |',
    '| /neko ip | 接続元のIPアドレスを表示します |',
    '| /neko cal | 当月カレンダーをMarkdownテーブルで表示します |',
    '| /neko fymd | 今日以降でYYYYMMDDが最初に素数になる日を表示します |',
    '| /neko clog | 直近のコミットエージェントログを表示します |',
    '| /neko sessions | ユーザーセッションのログイン時刻を新しい順に表示します |',
    '| /neko limit | Codex / Claude Code のリミット確認先を表示します |',
    '| /neko uuidgen4 | UUIDv4を1件生成し、UUID生成履歴に保存します |',
    '| /neko uuidgen7 | UUIDv7を1件生成し、UUID生成履歴に保存します |',
    '| /neko search <キーワード> | 質問文・回答文にキーワードを含む過去ログのヒット件数を表示します(結果一覧は最大30件までモーダルで確認できます) |',
    '| /neko s [--enable-logging] <検索語 ...> | 最大20個の検索語を順番に過去ログ検索します。空白を含む検索語は引用符で囲みます。--enable-loggingを付けると検索キーワード履歴に記録します |',
    '| /neko vcount | ベクタ化済みの回答文の件数と全回答文に占める割合を表示します(結果一覧は最大30件までモーダルで確認できます) |',
    '| /neko tokens | 過去24時間のモデル別トークン使用量を1時間刻みでMarkdownテーブル表示し、末尾にモデル別総和も表示します |',
    '| /neko tcheck <nkapi_トークン> | APIトークンが現在有効かどうかを確認します |',
    '| /neko 256 <文字列> | 指定した文字列のSHA-256ハッシュをWASM(Rust実装)で計算します |',
    '| /neko factor <数値> | 指定した整数(0以上2^53以下)をWASM(Rust実装)で素因数分解します |',
    '| /neko factor -a <日数> | 今日から指定日数後までのYYYYMMDD日付のうち、WASM(Rust実装)で素数と判定された日を一覧表示します |',
    '| /neko dig <ドメイン> [タイプ] | 指定ドメインのDNS問い合わせをWASM(Rust実装)で行います。詳細は /neko dig --help |',
    '| /neko ls [-l] [-a] | WASMモジュール一覧をGNU coreutilsのls書式でWASM(Rust実装)表示します(-lで長形式、-aで全件) |',
    '| /neko gh pr list <owner/repo> | 指定リポジトリのオープン中プルリクエスト一覧をWASM(Rust実装)でMarkdownテーブル表示します |',
    '| /neko tlist | /countdownページに登録した、次の予定一覧をMarkdownテーブルで表示します |',
    '| /neko mlb [AL\\|NL] [EAST\\|CENTRAL\\|WEST] | MLB本日の試合開始時刻・対戦カード・両チーム先発投手をMarkdownテーブルで表示します(引数省略で全試合) |',
    '| /neko help | このサブコマンド一覧を表示します |',
  ].join('\n');
}

/** `/neko tcheck` の引数が無い、またはAPIトークン形式でない場合に表示する説明。 */
export function formatTokenCheckHelp(): string {
  return [
    '```',
    '/neko tcheck <nkapi_トークン>',
    '',
    '指定したAPIトークンが現在有効かどうかを確認します。',
    'トークンには nkapi_ から始まる文字列を1つ指定してください。',
    '```',
  ].join('\n');
}

/**
 * `/neko dig --help` 用のオプション一覧をMarkdownテーブルで返す。
 * 罫線・ツリー文字は使わずMarkdownテーブルで表現する（CLAUDE.mdルール16）。
 */
export function formatDigHelp(): string {
  return [
    '## /neko dig ヘルプ',
    '指定したドメインのDNS問い合わせを行います(DNS over HTTPS経由。DNSワイヤーフォーマットの',
    '問い合わせパケット組み立て・応答パケット解析はRust/WASMで行います)。',
    '',
    '| 書式 | 説明 |',
    '|---|---|',
    '| /neko dig <ドメイン> | Aレコードを問い合わせます(タイプ省略時のデフォルト) |',
    '| /neko dig <ドメイン> <タイプ> | 指定したレコードタイプを問い合わせます |',
    '| /neko dig -t <タイプ> <ドメイン> | dig(1)の-tオプションと同じ書式で問い合わせます |',
    '| /neko dig --help / -h | このヘルプを表示します |',
    '',
    '対応レコードタイプ: A, AAAA, NS, CNAME, MX, TXT, SOA, PTR, SRV, ANY',
  ].join('\n');
}

/**
 * `/neko dig` の実行結果(digWasmServer側で整形済みのdig(1)風テキスト)を
 * コードブロックで表示する。
 */
export function formatDigResult(result: string): string {
  return ['## dig (WASM)', '```', result, '```'].join('\n');
}

export type CommitAgentLogRow = {
  commit_sha: string | null;
  commit_message: string | null;
  detected_agent_name: string | null;
  created_at: string;
};

export type UserSessionLoginRow = {
  user_id: string;
  last_login_at: string | null;
  current_login_at: string;
};

/** `/neko sessions` の取得結果をMarkdownテーブルで表示する。 */
export function formatUserSessionLogins(rows: UserSessionLoginRow[]): string {
  if (rows.length === 0) {
    return '## ユーザーセッション\n記録はありません。';
  }
  const escapeCell = (value: string | null) => (value ?? '—').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  return [
    '## ユーザーセッション',
    '| user_id | last_login_at | current_login_at |',
    '|---|---|---|',
    ...rows.map((row) => `| ${escapeCell(row.user_id)} | ${escapeCell(row.last_login_at)} | ${escapeCell(row.current_login_at)} |`),
  ].join('\n');
}

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

/**
 * `/neko s` の引数を、半角スペースまたはタブで区切る。ASCII/全角の二重引用符で
 * 囲まれた範囲は、内側の半角スペースを含めて1引数として扱う。
 */
export function parseNekoSearchArguments(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let quote: '"' | '\u201c' | null = null;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quote) {
      const closesQuote = (quote === '"' && char === '"') || (quote === '\u201c' && char === '\u201d');
      if (closesQuote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === '\u201c') {
      quote = char;
    } else if (char === ' ' || char === '\t') {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) args.push(current);
  return args;
}

export function formatAichatMultiSearchResults(outcomes: Array<{ keyword: string; hitCount: number }>): string {
  if (outcomes.length === 0) {
    return '❌ 検索語を指定してください: /neko s <検索語 ...>';
  }
  return ['過去ログを検索しました:', ...outcomes.map(({ keyword, hitCount }) => `- 「${keyword}」: ${hitCount}件`)].join('\n');
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

/**
 * `/neko ls [-l] [-a]` の結果を表示する。resultはGNU coreutilsのlsコマンドの
 * 出力書式(短形式は1行1名前、-l指定時は長形式)で渡される。0件(全件が-aなしで
 * 除外された場合等)ならその旨を明示する(空のコードブロックだけを出さない)。
 */
export function formatLsWasmResult(result: string): string {
  if (!result) {
    return ['## ls (WASM)', '(表示できる項目がありません)'].join('\n');
  }
  return ['## ls (WASM)', '```', result, '```'].join('\n');
}

export type HourlyTokenUsageRow = {
  hour: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  request_count: number;
};

/**
 * `/neko tokens` の結果を、時間帯(hour)ごとにMarkdownテーブルで表示する。
 * 罫線・ツリー文字は使わずMarkdownテーブルで表現する(CLAUDE.mdルール16)。
 * 同じ時間帯に複数モデルの利用があれば、その時間帯内で行を分けて表示する。
 * 末尾には、期間内に使われたモデルをループ元にして使用量を合算した
 * モデル別総和テーブルを付け加える(登場順を維持する)。
 */
export function formatHourlyTokenUsage(rows: HourlyTokenUsageRow[]): string {
  if (rows.length === 0) {
    return '## 過去24時間のトークン使用量\n直近24時間の記録はありません。';
  }
  const header = '| 時間帯(JST) | モデル | 入力 | 出力 | 件数 |';
  const separator = '|---|---|---:|---:|---:|';
  const lines = rows.map((r) => {
    const model = r.model.split('/').pop() || r.model;
    return `| ${r.hour} | ${model} | ${r.input_tokens.toLocaleString()} | ${r.output_tokens.toLocaleString()} | ${r.request_count} |`;
  });
  const totalIn = rows.reduce((sum, r) => sum + (r.input_tokens || 0), 0);
  const totalOut = rows.reduce((sum, r) => sum + (r.output_tokens || 0), 0);
  const totalReq = rows.reduce((sum, r) => sum + (r.request_count || 0), 0);

  const modelOrder: string[] = [];
  const modelTotals = new Map<string, { input_tokens: number; output_tokens: number; request_count: number }>();
  rows.forEach((r) => {
    if (!modelTotals.has(r.model)) {
      modelOrder.push(r.model);
      modelTotals.set(r.model, { input_tokens: 0, output_tokens: 0, request_count: 0 });
    }
    const acc = modelTotals.get(r.model)!;
    acc.input_tokens += r.input_tokens || 0;
    acc.output_tokens += r.output_tokens || 0;
    acc.request_count += r.request_count || 0;
  });
  const modelHeader = '| モデル | 入力 | 出力 | 件数 |';
  const modelSeparator = '|---|---:|---:|---:|';
  const modelLines = modelOrder.map((m) => {
    const acc = modelTotals.get(m)!;
    const shortModel = m.split('/').pop() || m;
    return `| ${shortModel} | ${acc.input_tokens.toLocaleString()} | ${acc.output_tokens.toLocaleString()} | ${acc.request_count} |`;
  });

  return [
    '## 過去24時間のトークン使用量',
    header,
    separator,
    ...lines,
    '',
    `計: 入力 ${totalIn.toLocaleString()} / 出力 ${totalOut.toLocaleString()} / ${totalReq}件`,
    '',
    '### モデル別総和',
    modelHeader,
    modelSeparator,
    ...modelLines,
  ].join('\n');
}

export type AichatSlashCommandDeps = {
  fetchLatestCommitAgentLog: () => Promise<CommitAgentLogRow | null>;
  fetchUserSessionLogins?: () => Promise<UserSessionLoginRow[]>;
  clientIp?: string;
  searchShares?: (keyword: string) => Promise<AichatSearchOutcome>;
  logSearchShares?: (keyword: string, outcome: AichatSearchOutcome) => Promise<void>;
  vectorizedAnswers?: () => Promise<AichatVectorizedAnswersOutcome>;
  hourlyTokenUsage?: () => Promise<HourlyTokenUsageRow[]>;
  checkApiToken?: (token: string) => Promise<boolean>;
  sha256ViaWasm?: (input: string) => Promise<string>;
  factorViaWasm?: (n: number) => Promise<string>;
  isPrimeViaWasm?: (n: number) => Promise<boolean>;
  digLookup?: (name: string, qtype: string) => Promise<string>;
  lsViaWasm?: (long: boolean, all: boolean) => Promise<string>;
  ghPrList?: (repoFullName: string) => Promise<string>;
  generateUuid?: (version: 'v4' | 'v7') => Promise<string>;
  countdownList?: () => Promise<CountdownListItem[]>;
  fetchMlbTodaySchedule?: () => Promise<MlbTodayGame[]>;
};

export type CountdownListItem = {
  label: string;
  targetAt: string;
};

/**
 * `/neko tlist` の結果を、日時昇順のMarkdownテーブルで表示する。
 * 罫線・ツリー文字は使わずMarkdownテーブルで表現する（CLAUDE.mdルール16）。
 * 0件の場合は「登録されている予定はありません」を返す。
 */
export function formatCountdownListResult(events: CountdownListItem[]): string {
  if (events.length === 0) {
    return ['## 次の予定一覧', '登録されている予定はありません(/countdownページから登録できます)'].join('\n');
  }
  const rows = events.map((ev) => {
    const at = new Date(ev.targetAt);
    const y = at.getFullYear();
    const mo = String(at.getMonth() + 1).padStart(2, '0');
    const d = String(at.getDate()).padStart(2, '0');
    const h = String(at.getHours()).padStart(2, '0');
    const mi = String(at.getMinutes()).padStart(2, '0');
    return `| ${y}/${mo}/${d} ${h}:${mi} | ${ev.label} |`;
  });
  return [
    '## 次の予定一覧',
    '| 日時 | 予定 |',
    '|---|---|',
    ...rows,
  ].join('\n');
}

export type MlbTodayGame = {
  gameDate: string;
  awayTeamId: number;
  homeTeamId: number;
  awayAbbr: string;
  homeAbbr: string;
  awayPitcher: string | null;
  homePitcher: string | null;
};

export type MlbDivisionFilter = 'all' | 'AL' | 'NL' | 'AL-EAST' | 'AL-CENTRAL' | 'AL-WEST' | 'NL-EAST' | 'NL-CENTRAL' | 'NL-WEST';

const MLB_DIVISION_FILTER_INDEX: Record<string, number> = {
  'AL-EAST': 0,
  'AL-CENTRAL': 1,
  'AL-WEST': 2,
  'NL-EAST': 3,
  'NL-CENTRAL': 4,
  'NL-WEST': 5,
};

/**
 * `/neko mlb [AL|NL] [EAST|CENTRAL|WEST]` の引数を解釈する。
 * 引数なしは「すべて」、league単独はAL/NL全体、league+地区名は該当地区のみ。
 * 形式が不正な場合はnullを返す(呼び出し側で書式エラーを表示する)。
 */
export function parseMlbFilterArgs(args: string[]): { filter: MlbDivisionFilter; label: string } | null {
  if (args.length === 0) return { filter: 'all', label: 'すべて' };
  const a0 = args[0].toUpperCase();
  if (args.length === 1 && (a0 === 'AL' || a0 === 'NL')) {
    return { filter: a0, label: a0 };
  }
  if (args.length >= 2) {
    const a1 = args[1].toUpperCase();
    if ((a0 === 'AL' || a0 === 'NL') && (a1 === 'EAST' || a1 === 'CENTRAL' || a1 === 'WEST')) {
      return { filter: `${a0}-${a1}` as MlbDivisionFilter, label: `${a0} ${a1}` };
    }
  }
  return null;
}

/** フィルターに該当するMLB team.idの一覧を返す。'all'の場合はnull(絞り込みなし)。 */
export function mlbFilterTeamIds(filter: MlbDivisionFilter): number[] | null {
  if (filter === 'all') return null;
  if (filter === 'AL') return [0, 1, 2].flatMap((i) => MLB_DIVISIONS[i].teams);
  if (filter === 'NL') return [3, 4, 5].flatMap((i) => MLB_DIVISIONS[i].teams);
  const idx = MLB_DIVISION_FILTER_INDEX[filter];
  return idx !== undefined ? MLB_DIVISIONS[idx].teams : null;
}

/** away/homeいずれかのチームがフィルターに該当する試合のみに絞り込む。 */
export function filterMlbGamesByDivision(games: MlbTodayGame[], filter: MlbDivisionFilter): MlbTodayGame[] {
  const ids = mlbFilterTeamIds(filter);
  if (!ids) return games;
  return games.filter((g) => ids.includes(g.awayTeamId) || ids.includes(g.homeTeamId));
}

function formatMlbGameTimeCell(gameDateIso: string): string {
  const d = new Date(gameDateIso);
  if (Number.isNaN(d.getTime())) return gameDateIso || '(時刻不明)';
  const et = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  const jst = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
  return `${et} ET / ${jst} JST`;
}

/**
 * `/neko mlb` の結果を、開始時刻昇順のMarkdownテーブルで表示する。
 * 罫線・ツリー文字は使わずMarkdownテーブルで表現する（CLAUDE.mdルール16）。
 * 先発投手が未発表の場合は「未定」でフォールバックし、空文字にしない。
 */
export function formatMlbTodayScheduleResult(games: MlbTodayGame[], filterLabel: string): string {
  const title = `## MLB 本日の試合予定(${filterLabel})`;
  if (games.length === 0) {
    return `${title}\n該当する試合はありません`;
  }
  const sorted = games.slice().sort((a, b) => (a.gameDate < b.gameDate ? -1 : a.gameDate > b.gameDate ? 1 : 0));
  const rows = sorted.map((g) => {
    const away = g.awayPitcher ?? '未定';
    const home = g.homePitcher ?? '未定';
    return `| ${formatMlbGameTimeCell(g.gameDate)} | ${g.awayAbbr} @ ${g.homeAbbr} | ${away} | ${home} |`;
  });
  return [
    title,
    '| 開始時刻 | 対戦カード | アウェイ先発 | ホーム先発 |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

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

  if (!subcommand) {
    return { handled: true, response: formatAichatSlashCommandHelp() };
  }

  if (subcommand === 'hms') {
    return { handled: true, response: formatJstDateTime(now) };
  }

  if (subcommand === 'epoch') {
    return { handled: true, response: formatEpochTime(now) };
  }

  if (subcommand === 'ip') {
    return {
      handled: true,
      response: deps.clientIp
        ? `接続元IPアドレス: ${deps.clientIp}`
        : '❌ 接続元IPアドレスを取得できませんでした',
    };
  }

  if (subcommand === 'cal') {
    return { handled: true, response: formatJstMonthCalendar(now) };
  }

  if (subcommand === 'fymd') {
    if (!deps.isPrimeViaWasm) {
      return { handled: true, response: '❌ /neko fymd は現在利用できません(WASM未設定)' };
    }
    const FYMD_SEARCH_CAP_DAYS = 3650;
    try {
      for (const ymd of buildYmdCandidates(now, FYMD_SEARCH_CAP_DAYS)) {
        if (await deps.isPrimeViaWasm(Number(ymd))) {
          return { handled: true, response: ymd };
        }
      }
      return { handled: true, response: `❌ 今日から${FYMD_SEARCH_CAP_DAYS}日以内に素数日が見つかりませんでした` };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko fymd の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'clog') {
    const row = await deps.fetchLatestCommitAgentLog();
    return { handled: true, response: formatCommitAgentLogEntry(row) };
  }

  if (subcommand === 'sessions') {
    if (!deps.fetchUserSessionLogins) {
      return { handled: true, response: '❌ /neko sessions は現在利用できません(DB未設定)' };
    }
    const outcome = await raceWithTimeout(deps.fetchUserSessionLogins(), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return { handled: true, response: `❌ /neko sessions がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)` };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko sessions でエラーが発生しました: ${outcome.message}` };
    }
    return { handled: true, response: formatUserSessionLogins(outcome.value) };
  }

  if (subcommand === 'limit') {
    return { handled: true, response: formatAiToolLimitInfo(now) };
  }

  if (subcommand === 'uuidgen4' || subcommand === 'uuidgen7') {
    const version = subcommand === 'uuidgen4' ? 'v4' : 'v7';
    if (!deps.generateUuid) {
      return { handled: true, response: `❌ /neko ${subcommand} は現在利用できません(UUID生成API未設定)` };
    }
    try {
      return { handled: true, response: await deps.generateUuid(version) };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko ${subcommand} の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
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

  if (subcommand === 's') {
    // partsでは引用符内の空白が失われるため、サブコマンドより後ろの原文を解析する。
    const argumentText = trimmed.replace(/^\/neko\s+s(?:\s+|$)/i, '');
    const parsedArguments = parseNekoSearchArguments(argumentText);
    // 日本語入力時に変換されることがあるem dashも同じオプションとして受け付ける。
    const loggingEnabled = parsedArguments.some((arg) => arg === '--enable-logging' || arg === '\u2014enable-logging');
    const keywords = parsedArguments
      .filter((arg) => arg !== '--enable-logging' && arg !== '\u2014enable-logging')
      .slice(0, 20);
    if (keywords.length === 0) {
      return { handled: true, response: formatAichatMultiSearchResults([]) };
    }
    if (!deps.searchShares) {
      return { handled: true, response: '❌ /neko s は現在利用できません(過去ログ検索API未設定)' };
    }

    const summaries: Array<{ keyword: string; hitCount: number }> = [];
    const modalResults = new Map<string, AichatResultItem>();
    for (const keyword of keywords) {
      const outcome = await raceWithTimeout(deps.searchShares(keyword), AICHAT_SEARCH_TIMEOUT_MS);
      if (outcome.status === 'timeout') {
        return { handled: true, response: `❌ /neko s の「${keyword}」検索がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)` };
      }
      if (outcome.status === 'error') {
        return { handled: true, response: `❌ /neko s の「${keyword}」検索でエラーが発生しました: ${outcome.message}` };
      }
      summaries.push({ keyword, hitCount: outcome.value.hitCount });
      if (loggingEnabled && deps.logSearchShares) {
        const logged = await raceWithTimeout(deps.logSearchShares(keyword, outcome.value), AICHAT_SEARCH_TIMEOUT_MS);
        if (logged.status === 'timeout') {
          return { handled: true, response: `❌ /neko s の「${keyword}」履歴記録がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)` };
        }
        if (logged.status === 'error') {
          return { handled: true, response: `❌ /neko s の「${keyword}」履歴記録でエラーが発生しました: ${logged.message}` };
        }
      }
      for (const result of outcome.value.results) modalResults.set(result.id, result);
    }
    const results = Array.from(modalResults.values()).slice(0, 30);
    return {
      handled: true,
      response: formatAichatMultiSearchResults(summaries),
      resultsForModal: results.length > 0 ? results : undefined,
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
    if ((parts[2] ?? '').trim() === '-a') {
      const MAX_SEARCH_DAYS = 3650;
      const rawDays = (parts[3] ?? '').trim();
      const days = Number(rawDays);
      if (!rawDays || !Number.isFinite(days) || !Number.isInteger(days) || days < 1 || days > MAX_SEARCH_DAYS) {
        return {
          handled: true,
          response: `❌ 日数は1以上${MAX_SEARCH_DAYS}以下の整数で指定してください: /neko factor -a <日数>`,
        };
      }
      if (!deps.isPrimeViaWasm) {
        return { handled: true, response: '❌ /neko factor -a は現在利用できません(WASM未設定)' };
      }
      try {
        const primeYmds: string[] = [];
        for (const ymd of buildYmdCandidates(now, days)) {
          if (await deps.isPrimeViaWasm(Number(ymd))) primeYmds.push(ymd);
        }
        return { handled: true, response: formatPrimeYmdSearchResult(days, primeYmds) };
      } catch (err) {
        return {
          handled: true,
          response: `❌ /neko factor -a の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

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

  if (subcommand === 'dig') {
    const args = parts.slice(2);
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
      return { handled: true, response: formatDigHelp() };
    }

    let name: string;
    let qtype = 'A';
    if (args[0] === '-t') {
      qtype = (args[1] ?? '').toUpperCase();
      name = args[2] ?? '';
      if (!qtype || !name) {
        return { handled: true, response: '❌ 書式が正しくありません: /neko dig -t <タイプ> <ドメイン>' };
      }
    } else {
      name = args[0];
      if (args[1]) qtype = args[1].toUpperCase();
    }

    if (!deps.digLookup) {
      return { handled: true, response: '❌ /neko dig は現在利用できません(WASM未設定)' };
    }
    try {
      const result = await deps.digLookup(name, qtype);
      return { handled: true, response: formatDigResult(result) };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko dig の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'tlist') {
    if (!deps.countdownList) {
      return { handled: true, response: '❌ /neko tlist は現在利用できません(DB未設定)' };
    }
    try {
      const events = await deps.countdownList();
      return { handled: true, response: formatCountdownListResult(events) };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko tlist の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'ls') {
    const args = parts.slice(2);
    const long = args.includes('-l') || args.includes('-la') || args.includes('-al');
    const all = args.includes('-a') || args.includes('-la') || args.includes('-al');
    if (!deps.lsViaWasm) {
      return { handled: true, response: '❌ /neko ls は現在利用できません(WASM未設定)' };
    }
    try {
      const result = await deps.lsViaWasm(long, all);
      return { handled: true, response: formatLsWasmResult(result) };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko ls の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'gh') {
    const args = parts.slice(2);
    if (args[0] !== 'pr' || args[1] !== 'list') {
      return {
        handled: true,
        response: '❌ 対応しているコマンドは /neko gh pr list <owner/repo> のみです',
      };
    }
    const repoArg = args[2];
    if (!repoArg) {
      return { handled: true, response: '❌ リポジトリを指定してください: /neko gh pr list <owner/repo>' };
    }
    if (!deps.ghPrList) {
      return { handled: true, response: '❌ /neko gh pr list は現在利用できません(WASM未設定)' };
    }
    try {
      const result = await deps.ghPrList(repoArg);
      return { handled: true, response: result };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko gh pr list の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'mlb') {
    const parsed = parseMlbFilterArgs(parts.slice(2));
    if (!parsed) {
      return { handled: true, response: '❌ 書式が正しくありません: /neko mlb [AL|NL] [EAST|CENTRAL|WEST]' };
    }
    if (!deps.fetchMlbTodaySchedule) {
      return { handled: true, response: '❌ /neko mlb は現在利用できません(MLBスケジュールAPI未設定)' };
    }
    const outcome = await raceWithTimeout(deps.fetchMlbTodaySchedule(), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko mlb がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko mlb でエラーが発生しました: ${outcome.message}` };
    }
    const filtered = filterMlbGamesByDivision(outcome.value, parsed.filter);
    return { handled: true, response: formatMlbTodayScheduleResult(filtered, parsed.label) };
  }

  if (subcommand === 'tokens') {
    if (!deps.hourlyTokenUsage) {
      return { handled: true, response: formatHourlyTokenUsage([]) };
    }
    const outcome = await raceWithTimeout(deps.hourlyTokenUsage(), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko tokens がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)。データ量が多い可能性があります。時間をおいて再度お試しください。`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko tokens でエラーが発生しました: ${outcome.message}` };
    }
    return { handled: true, response: formatHourlyTokenUsage(outcome.value) };
  }

  if (subcommand === 'tcheck') {
    const token = parts[2] ?? '';
    if (parts.length !== 3 || !token.startsWith('nkapi_')) {
      return { handled: true, response: formatTokenCheckHelp() };
    }
    if (!deps.checkApiToken) {
      return { handled: true, response: '❌ /neko tcheck は現在利用できません(APIトークン検証機能未設定)' };
    }
    try {
      const valid = await deps.checkApiToken(token);
      return { handled: true, response: valid ? '✅ APIトークンは有効です。' : '❌ APIトークンは無効です。' };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko tcheck の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'help') {
    return { handled: true, response: formatAichatSlashCommandHelp() };
  }

  return {
    handled: true,
    response: `❌ 未対応のサブコマンドです: ${subcommand}\n利用可能なコマンド: /neko hms, /neko epoch, /neko ip, /neko cal, /neko fymd, /neko clog, /neko sessions, /neko limit, /neko uuidgen4, /neko uuidgen7, /neko search, /neko s, /neko vcount, /neko tokens, /neko tcheck, /neko 256, /neko factor, /neko dig, /neko ls, /neko gh, /neko tlist, /neko mlb, /neko help\n詳細は /neko help を実行してください`,
  };
}
