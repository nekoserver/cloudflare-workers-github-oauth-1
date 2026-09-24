import { MLB_DIVISIONS } from './mlbDivisions';
import { getRubyWasmVersionInfo, type RubyWasmVersionInfo } from '../views/rubyWasm';
import { AICHAT_SOURCE_LABELS, type AichatSourceKey } from './aichatSourceStats';
import type { TreeFormatOptions } from './treeWasmServer';

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

/**
 * Cursor VM起動履歴の created_at(SQLite datetime('now')=UTC、TZなし)をJST表示にする。
 * 欠落・不正は空文字で握りつぶさない。
 */
export function formatCursorAgentCreatedAtJst(createdAt: string | null | undefined): string {
  if (!createdAt || !createdAt.trim()) return '(時刻不明)';
  const utcString = createdAt.trim();
  const isoUtc = utcString.includes('T')
    ? utcString
    : utcString.replace(' ', 'T') + (utcString.endsWith('Z') ? '' : 'Z');
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return utcString;
  return formatJstDateTime(d);
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
    '| /neko tvlog | tree-view更新の最新10件を表示します |',
    '| /neko tvupdate [--force] [--dryrun] [-R owner/repo] | 元のJSONで展開済みのtree-viewリポジトリを手動更新します。--forceは1時間の待機を省略し、--dryrunは書き換えず更新イメージと現状の差分だけを表示します |',
    '| /neko sessions | ユーザーセッションのログイン時刻を新しい順に表示します |',
    '| /neko limit | Codex / Claude Code のリミット確認先を表示します |',
    '| /neko uuidgen4 | UUIDv4を1件生成し、UUID生成履歴に保存します |',
    '| /neko uuidgen7 | UUIDv7を1件生成し、UUID生成履歴に保存します |',
    '| /neko search <キーワード> | 質問文・回答文にキーワードを含む過去ログのヒット件数を表示します(結果一覧は最大30件までモーダルで確認できます) |',
    '| /neko qsearch <キーワード> | 質問文・回答文にキーワードを含む過去ログを検索し、ヒットした質問文と回答モデルを表で表示します。各行の先頭は質問IDです。質問IDと言語モデルをパラメータとして最上位モーダルで最新の回答を読みます |',
    '| /neko csearch <キーワード> | Cursor VMの過去ログを検索し、ヒットした質問文を表で表示します。各行の先頭は作成時刻(JST)です。「表示」リンクから最上位モーダルでキャッシュを読みます |',
    '| /neko s [--enable-logging] <検索語 ...> | 最大20個の検索語を順番に過去ログ検索します。空白を含む検索語は引用符で囲みます。--enable-loggingを付けると検索キーワード履歴に記録します |',
    '| /neko vcount | ベクタ化済みの回答文の件数と全回答文に占める割合を表示します(結果一覧は最大30件までモーダルで確認できます) |',
    '| /neko j <キーワード> | 通常のJevデータベース(jev_country_keyword_evaluations)にそのキーワードの評価データが登録されているかを確認し、ヒット件数を表示します |',
    '| /neko tokens | 過去24時間のモデル別トークン使用量を1時間刻みでMarkdownテーブル表示し、末尾にモデル別総和も表示します |',
    '| /neko tcheck <nkapi_トークン> | APIトークンが現在有効かどうかを確認します |',
    '| /neko 256 <文字列> | 指定した文字列のSHA-256ハッシュをWASM(Rust実装)で計算します |',
    '| /neko kana <全角カナ> | 全角カタカナを半角カナに変換します(カタカナ以外の文字はそのまま残ります) |',
    '| /neko aireqst | 今月のリクエスト元別(Slack/AIチャット入力窓/回答伝播ページ/ダイナミックワーカー)の件数・割合を表示します |',
    '| /neko factor <数値> | 指定した整数(0以上2^53以下)をWASM(Rust実装)で素因数分解します |',
    '| /neko factor -a <日数> | 今日から指定日数後までのYYYYMMDD日付のうち、WASM(Rust実装)で素数と判定された日を一覧表示します |',
    '| /neko dig <ドメイン> [タイプ] | 指定ドメインのDNS問い合わせをWASM(Rust実装)で行います。詳細は /neko dig --help |',
    '| /neko ls [-l] [-a] | WASMモジュール一覧をGNU coreutilsのls書式でWASM(Rust実装)表示します(-lで長形式、-aで全件) |',
    '| /neko gh pr list <owner/repo> | 指定リポジトリのオープン中プルリクエスト一覧をWASM(Rust実装)でMarkdownテーブル表示します |',
    '| /neko tree <owner/repo> [options] | ツリーを表示します。--depth、--pattern、--files-only、--dirs-only、--hidden、--sort name\|time、--reverseに対応 |',
    '| /neko msb --help | microsandboxのCLI `msb` のヘルプ一覧をWASM(Rust実装)で表示します(msb本体の実行はできません) |',
    '| /neko tlist | /countdownページに登録した、次の予定一覧をMarkdownテーブルで表示します |',
    '| /neko sql impact <テーブル名> | D1クエリカタログからSQL変更影響を表示します |',
    '| /neko mlb | MLB本日の試合開始時刻・対戦カード・両チーム先発投手をMarkdownテーブルで表示します(引数省略で全試合) |',
    '| /neko hellodw | ダイナミックWorker(dynamicneko)にhelloを送り、worldが返るか起動確認します |',
    '| /neko rubyver | /ruby-wasmページが読み込むRuby/WASMのビルドライン・パッケージバージョンを表示します |',
    '| /neko vlink <キーワード> | Googleで「YouTube <キーワード>」を検索し、www.youtube.comのリンクのみを抽出して表示します |',
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

/**
 * `/neko hellodw` の結果を表示する。dynamicneko側は"world"以外の文字列を
 * 返すこともある(異常系: LOADER.load()自体が失敗した場合の502等)ため、
 * 期待通り"world"が返ったかどうかで見出しを分ける。
 */
export function formatDynamicWorkerPingResult(reply: string): string {
  if (reply === 'world') {
    return '## ダイナミックWorker起動確認 (dynamicneko)\n✅ hello → world (LOADER.load()経由で使い捨てisolateが正常に応答しました)';
  }
  return `## ダイナミックWorker起動確認 (dynamicneko)\n⚠️ 想定外の応答: ${reply}`;
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
  model?: string;
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

export const AICHAT_QSEARCH_LIMIT = 30;

export type AichatQsearchItem = {
  id: string;
  question: string;
  model: string;
};

export type AichatQsearchOutcome = {
  results: AichatQsearchItem[];
};

/**
 * スラッシュコマンド `/neko qsearch` 用に、AIチャット過去ログ行を表行へ変換する。
 * チャット本文を埋め尽くさないよう最大30件。空の質問文・モデルは握りつぶさない。
 */
export function formatAichatQsearchModelName(model: string | null | undefined): string {
  if (!model || !model.trim()) return '(モデル不明)';
  const trimmed = model.trim();
  return trimmed.split('/').pop() || trimmed;
}

export function mapAiChatSharesToQsearchItems(
  rows: Array<{ id: string; question?: string | null; model?: string | null }>,
  limit = AICHAT_QSEARCH_LIMIT,
): AichatQsearchItem[] {
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    question: (row.question ?? '').replace(/\r?\n/g, ' ').trim() || '(質問文なし)',
    model: formatAichatQsearchModelName(row.model),
  }));
}

function encodeAichatQsearchParam(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => {
    const hex = ch.charCodeAt(0).toString(16).toUpperCase();
    return '%' + hex;
  });
}

export function buildAichatQsearchIdHref(item: AichatQsearchItem): string {
  return `#qsearch?id=${encodeAichatQsearchParam(item.id)}&model=${encodeAichatQsearchParam(item.model)}`;
}

export function parseAichatQsearchHref(href: string | null | undefined): { id: string; model: string } | null {
  if (!href) return null;
  const normalized = href.replace(/&amp;/g, '&');
  const prefix = '#qsearch?';
  if (!normalized.startsWith(prefix)) return null;
  const params = new URLSearchParams(normalized.slice(prefix.length));
  const id = params.get('id') ?? '';
  if (!id) return null;
  return { id, model: params.get('model') ?? '' };
}

export function formatAichatQsearchAnswerText(payload: {
  answer?: unknown;
  error?: unknown;
}): string {
  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  if (typeof payload.answer === 'string' && payload.answer.length > 0) {
    return payload.answer;
  }
  return '回答文がありません';
}

/**
 * スラッシュコマンド `/neko qsearch` の応答本文。ヒット有無の件数だけにせず、
 * 質問ID・質問文・回答モデル列のMarkdown表を返す。
 * 質問IDは parseMd が実アンカーを作れるよう [id](#qsearch?id=&model=) にする。
 */
export function formatAichatNekoQsearchResults(keyword: string, outcome: AichatQsearchOutcome): string {
  if (!keyword) {
    return '❌ キーワードを指定してください: /neko qsearch <キーワード>';
  }
  if (outcome.results.length === 0) {
    return `AIチャット過去ログ「${keyword}」: 0件`;
  }
  const escapeCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  return [
    `## AIチャット過去ログ検索「${keyword}」`,
    '| 質問ID | 質問文 | モデル |',
    '|---|---|---|',
    ...outcome.results.map((item) => {
      const label = escapeCell(item.id).replace(/\]/g, '');
      return `| [${label}](${buildAichatQsearchIdHref(item)}) | ${escapeCell(item.question)} | ${escapeCell(item.model)} |`;
    }),
  ].join('\n');
}

export const AICHAT_CSEARCH_LIMIT = 30;

export type CursorAgentCsearchItem = {
  id: number;
  question: string;
  createdAtJst: string;
};

export type CursorAgentCsearchOutcome = {
  results: CursorAgentCsearchItem[];
  searchError?: string | null;
};

/**
 * スラッシュコマンド `/neko csearch` 用に、Cursor VM履歴行を表行へ変換する。
 * チャット本文を埋め尽くさないよう最大30件。空prompt・欠落時刻は握りつぶさない。
 */
export function mapCursorAgentHistoryToCsearchItems(
  rows: Array<{ id: number; prompt?: string | null; created_at?: string | null }>,
  limit = AICHAT_CSEARCH_LIMIT,
): CursorAgentCsearchItem[] {
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    question: (row.prompt ?? '').replace(/\r?\n/g, ' ').trim() || '(質問文なし)',
    createdAtJst: formatCursorAgentCreatedAtJst(row.created_at),
  }));
}

/**
 * スラッシュコマンド `/neko csearch` の応答本文。ヒット有無の件数だけにせず、
 * 作成時刻(JST)・質問文・「表示」リンク列のMarkdown表を返す。
 * 表示セルは parseMd が実アンカーを作れるよう [表示](#csearch-{id}) にする。
 */
export function formatAichatNekoCsearchResults(keyword: string, outcome: CursorAgentCsearchOutcome): string {
  if (!keyword) {
    return '❌ キーワードを指定してください: /neko csearch <キーワード>';
  }
  if (outcome.results.length === 0) {
    const extra = outcome.searchError ? `\n⚠️ ${outcome.searchError}` : '';
    return `Cursor VM 過去ログ「${keyword}」: 0件${extra}`;
  }
  const escapeCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const lines = [
    `## Cursor VM 過去ログ検索「${keyword}」`,
    '| 作成時刻(JST) | 質問文 | 表示 |',
    '|---|---|---|',
    ...outcome.results.map((item) => {
      const created = escapeCell(item.createdAtJst?.trim() || '(時刻不明)');
      return `| ${created} | ${escapeCell(item.question)} | [表示](#csearch-${item.id}) |`;
    }),
  ];
  if (outcome.searchError) {
    lines.push('', `⚠️ ${outcome.searchError}`);
  }
  return lines.join('\n');
}

/**
 * スラッシュコマンド `/neko csearch` の回答全文モーダル本文。
 * 会話API(キャッシュ優先)のJSONから、空握りつぶしなしで表示文字列を組み立てる。
 */
export function formatCursorAgentCsearchAnswerText(payload: {
  answers?: unknown;
  error?: unknown;
  cacheError?: unknown;
}): string {
  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error;
  }
  const answers = Array.isArray(payload.answers)
    ? payload.answers.filter((a): a is string => typeof a === 'string' && a.length > 0)
    : [];
  if (answers.length === 0) {
    return 'キャッシュに回答文がありません';
  }
  const body = answers.join('\n\n');
  if (typeof payload.cacheError === 'string' && payload.cacheError.trim()) {
    return `${body}\n\n${payload.cacheError}`;
  }
  return body;
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

/** jev_label_id=1〜20(ループA)1件分。値が無いIDはnull(黙って除外しない)。 */
export type AichatJevKeywordScoreValue = { jevLabelId: number; value: number | null };

/** キーワードに一致したshare1件分のJev評価詳細(質問ID・質問文・モデル・1〜20の各スコア)。 */
export type AichatJevKeywordScoreShare = {
  shareId: string;
  question: string;
  model: string | null;
  values: AichatJevKeywordScoreValue[];
};

export type AichatJevKeywordLookupOutcome = {
  hitCount: number;
  /** ヒットしたshareのうち、先頭から最大AICHAT_JEV_KEYWORD_SCORE_LIMIT件のスコア詳細。 */
  results: AichatJevKeywordScoreShare[];
};

export const AICHAT_JEV_KEYWORD_SCORE_LIMIT = 5;

/**
 * `/neko j <キーワード>` の結果を表示する。jev_evaluations(dynamicnekoの
 * /ai-cacheページの一括評価ボタンが書き込む、share_id/modelで引く通常の
 * Jev評価結果)を、ai_chat_shares.question・answerのどちらかにキーワードが
 * 部分一致するかで絞り込み(searchAiChatSharesが使う検索キーと同じ意味論)、
 * 該当する評価済みshare件数と、各shareのjev_label_id=1〜20(ループA)の
 * 個別スコアをMarkdown表で表示する。表は質問ID1件=1行とし、ラベル1〜20を
 * 横方向の列として並べる(縦にラベル数だけ行を積まない)。罫線・ツリー文字は
 * 使わない(CLAUDE.mdルール16)。0件のときは「未登録」と明示し、「0件」
 * だけでは判別しづらい表示にならないようにする。
 */
export function formatJevKeywordLookup(keyword: string, outcome: AichatJevKeywordLookupOutcome): string {
  if (!keyword) {
    return '❌ キーワードを指定してください: /neko j <キーワード>';
  }
  if (outcome.hitCount === 0) {
    return `「${keyword}」のJev評価データ: 0件(未登録)`;
  }
  const escapeCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  // ラベルIDの列見出しは、結果に含まれる全shareのjevLabelIdの和集合を
  // 昇順に並べる(buildJevValuesForLoopは常に1〜20全件を返すため、
  // 通常は1〜20固定になる)。
  const labelIds = Array.from(new Set(outcome.results.flatMap((share) => share.values.map((v) => v.jevLabelId)))).sort((a, b) => a - b);
  const labelColumns = labelIds.map((id) => `L${id}`);
  const lines = [
    `「${keyword}」のJev評価データ: ${outcome.hitCount}件`,
    '',
    `| 質問ID | 質問文 | モデル | ${labelColumns.join(' | ')} |`,
    `|---|---|---|${labelColumns.map(() => '---').join('|')}|`,
  ];
  for (const share of outcome.results) {
    const valueByLabelId = new Map(share.values.map((v) => [v.jevLabelId, v.value]));
    const scoreCells = labelIds.map((id) => {
      const value = valueByLabelId.get(id);
      return value === undefined || value === null ? '-' : String(value);
    });
    lines.push(
      `| ${escapeCell(share.shareId)} | ${escapeCell(share.question)} | ${escapeCell(share.model ?? '(不明)')} | ${scoreCells.join(' | ')} |`
    );
  }
  if (outcome.hitCount > outcome.results.length) {
    lines.push('', `(先頭${outcome.results.length}件のみ表示。全${outcome.hitCount}件)`);
  }
  return lines.join('\n');
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
 * 全角カタカナ(濁点・半濁点付き含む)を半角カナ(JIS X 0201)に変換するテーブル。
 * ヶ・ヵ等、半角カナに対応する文字が存在しないものは変換対象に含めない
 * (変換せずそのまま残す)。
 */
const ZENKAKU_KATAKANA_TO_HANKAKU: Record<string, string> = {
  ガ: 'ｶﾞ', ギ: 'ｷﾞ', グ: 'ｸﾞ', ゲ: 'ｹﾞ', ゴ: 'ｺﾞ',
  ザ: 'ｻﾞ', ジ: 'ｼﾞ', ズ: 'ｽﾞ', ゼ: 'ｾﾞ', ゾ: 'ｿﾞ',
  ダ: 'ﾀﾞ', ヂ: 'ﾁﾞ', ヅ: 'ﾂﾞ', デ: 'ﾃﾞ', ド: 'ﾄﾞ',
  バ: 'ﾊﾞ', ビ: 'ﾋﾞ', ブ: 'ﾌﾞ', ベ: 'ﾍﾞ', ボ: 'ﾎﾞ',
  パ: 'ﾊﾟ', ピ: 'ﾋﾟ', プ: 'ﾌﾟ', ペ: 'ﾍﾟ', ポ: 'ﾎﾟ',
  ヴ: 'ｳﾞ',
  ア: 'ｱ', イ: 'ｲ', ウ: 'ｳ', エ: 'ｴ', オ: 'ｵ',
  カ: 'ｶ', キ: 'ｷ', ク: 'ｸ', ケ: 'ｹ', コ: 'ｺ',
  サ: 'ｻ', シ: 'ｼ', ス: 'ｽ', セ: 'ｾ', ソ: 'ｿ',
  タ: 'ﾀ', チ: 'ﾁ', ツ: 'ﾂ', テ: 'ﾃ', ト: 'ﾄ',
  ナ: 'ﾅ', ニ: 'ﾆ', ヌ: 'ﾇ', ネ: 'ﾈ', ノ: 'ﾉ',
  ハ: 'ﾊ', ヒ: 'ﾋ', フ: 'ﾌ', ヘ: 'ﾍ', ホ: 'ﾎ',
  マ: 'ﾏ', ミ: 'ﾐ', ム: 'ﾑ', メ: 'ﾒ', モ: 'ﾓ',
  ヤ: 'ﾔ', ユ: 'ﾕ', ヨ: 'ﾖ',
  ラ: 'ﾗ', リ: 'ﾘ', ル: 'ﾙ', レ: 'ﾚ', ロ: 'ﾛ',
  ワ: 'ﾜ', ヲ: 'ｦ', ン: 'ﾝ',
  ァ: 'ｧ', ィ: 'ｨ', ゥ: 'ｩ', ェ: 'ｪ', ォ: 'ｫ',
  ッ: 'ｯ', ャ: 'ｬ', ュ: 'ｭ', ョ: 'ｮ',
  ー: 'ｰ',
  '。': '｡', '「': '｢', '」': '｣', '、': '､', '・': '･',
};

/**
 * 全角カタカナを半角カナ(JIS X 0201)に変換する。カタカナ以外の文字
 * (ひらがな・漢字・英数字・半角文字等)はそのまま残す(変換対象外)。
 */
export function convertZenkakuKatakanaToHankaku(input: string): string {
  let result = '';
  for (const ch of input) {
    result += ZENKAKU_KATAKANA_TO_HANKAKU[ch] ?? ch;
  }
  return result;
}

/** `/neko kana <全角カナ>` の変換結果を表示する。 */
export function formatKanaConvertResult(input: string, converted: string): string {
  return ['## 半角カナ変換', `入力: ${input}`, `変換結果: ${converted}`].join('\n');
}

/**
 * 「日ごとキーワード数・質問数」モーダルのリクエスト元別円グラフ(views/aichat.ts の
 * SOURCE_COLORS)と同じ表示順(Slack→AIチャット入力窓→回答伝播ページ→
 * ダイナミックワーカー)を維持する。
 */
const AICHAT_SOURCE_ORDER: AichatSourceKey[] = ['slack', 'textbox', 'api', 'dynamicneko'];

/**
 * リクエスト元別円グラフと同じ配色(SOURCE_COLORS)に対応する絵文字の色見本。
 * チャット本文はプレーンテキスト/Markdownのみで実際のHEXカラーは表示できないため、
 * 近似の色の絵文字で代替する(slack=紫#611f69→🟪、textbox=水色#0ea5e9→🟦、
 * api=橙#f59e0b→🟧、dynamicneko=緑#10b981→🟩)。
 */
const AICHAT_SOURCE_SWATCH: Record<AichatSourceKey, string> = {
  slack: '🟪',
  textbox: '🟦',
  api: '🟧',
  dynamicneko: '🟩',
};

/**
 * リクエスト元別円グラフ(views/aichat.ts の SOURCE_COLORS)と同じ配色。
 * SVGはサーバー側でこの固定パレットと数値だけから組み立てる自前生成の
 * マークアップであり、外部入力(AI応答やユーザー入力)を一切埋め込まないため、
 * parseMd()のエスケープを経由させずクライアントでそのままinnerHTMLしてよい
 * (CLAUDE.mdの「非信頼入力は必ずエスケープする」方針の対象は、あくまで
 * AI生成テキスト等の非信頼入力であり、この関数の出力はそれに該当しない)。
 */
const AICHAT_SOURCE_HEX: Record<AichatSourceKey, string> = {
  slack: '#611f69',
  textbox: '#0ea5e9',
  api: '#f59e0b',
  dynamicneko: '#10b981',
};

type AichatSourceEntry = { key: AichatSourceKey; count: number };

/** 件数0を除外し、比率の多い順(降順)に並べたエントリ一覧を返す。 */
function sortAichatSourceEntries(totals: Record<AichatSourceKey, number>): AichatSourceEntry[] {
  return AICHAT_SOURCE_ORDER
    .map((key) => ({ key, count: totals[key] || 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * `/neko aireqst` の結果を表示する。「日ごとキーワード数・質問数」モーダルの
 * リクエスト元別円グラフと同じデータ(ai_chat_sharesのsource別件数)を、
 * 比率の多い順に並べたMarkdownテーブル(色見本+リクエスト元+件数+割合)として表示する。
 * 全件0(今月の質問が無い)場合は0除算を避け、その旨だけを表示する。
 */
export function formatAichatSourceTotals(totals: Record<AichatSourceKey, number>): string {
  const entries = sortAichatSourceEntries(totals);
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (total <= 0) {
    return ['## リクエスト元別統計(今月)', '今月はまだ質問がありません。'].join('\n');
  }

  const lines = ['## リクエスト元別統計(今月)', '| 色 | リクエスト元 | 件数 | 割合 |', '|---|---|---:|---:|'];
  entries.forEach(({ key, count }) => {
    const ratio = Math.round((count / total) * 1000) / 10;
    lines.push(`| ${AICHAT_SOURCE_SWATCH[key]} | ${AICHAT_SOURCE_LABELS[key]} | ${count}件 | ${ratio.toFixed(1)}% |`);
  });
  lines.push('', `合計: ${total}件`);
  return lines.join('\n');
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * `/neko aireqst` 用に、リクエスト元別統計を比率の多い順に並べたSVG円グラフを
 * 生成する(色見本+件数+割合の凡例付き)。全件0件の場合はnullを返し、
 * 呼び出し元は円グラフ無しのテキストのみにフォールバックする。
 * 1種類のみの場合(100%)はパス描画が退化するため円(circle)で表現する。
 */
export function buildAichatSourceTotalsSvg(totals: Record<AichatSourceKey, number>): string | null {
  const entries = sortAichatSourceEntries(totals);
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (total <= 0) return null;

  const cx = 60, cy = 60, r = 50;
  const slices: string[] = [];

  if (entries.length === 1) {
    slices.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${AICHAT_SOURCE_HEX[entries[0].key]}" />`);
  } else {
    let angle = -Math.PI / 2;
    entries.forEach(({ key, count }) => {
      const sliceAngle = (count / total) * 2 * Math.PI;
      const endAngle = angle + sliceAngle;
      const x1 = (cx + r * Math.cos(angle)).toFixed(2);
      const y1 = (cy + r * Math.sin(angle)).toFixed(2);
      const x2 = (cx + r * Math.cos(endAngle)).toFixed(2);
      const y2 = (cy + r * Math.sin(endAngle)).toFixed(2);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      slices.push(
        `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${AICHAT_SOURCE_HEX[key]}" stroke="#fff" stroke-width="0.5" />`
      );
      angle = endAngle;
    });
  }

  const legend = entries.map(({ key, count }, i) => {
    const y = 10 + i * 18;
    const ratio = Math.round((count / total) * 1000) / 10;
    const label = escapeXmlText(`${AICHAT_SOURCE_LABELS[key]} ${count}件 (${ratio.toFixed(1)}%)`);
    return `<rect x="132" y="${y}" width="11" height="11" rx="2" fill="${AICHAT_SOURCE_HEX[key]}" />` +
      `<text x="149" y="${y + 10}" font-size="12" font-family="sans-serif" fill="#1f2328">${label}</text>`;
  }).join('');

  const height = Math.max(120, 20 + entries.length * 18);
  return `<svg viewBox="0 0 340 ${height}" width="340" height="${height}" role="img" aria-label="リクエスト元別統計(今月)の円グラフ">` +
    slices.join('') + legend + '</svg>';
}

const YOUTUBE_LINK_PREFIX = 'https://www.youtube.com';

/**
 * `/neko vlink <キーワード>` 用。Google Custom Search JSON APIの検索結果
 * (items[].link)から、`https://www.youtube.com` で始まるリンクのみを
 * 抽出する(http://・youtu.be・m.youtube.com等は対象外。仕様が
 * 「特定のURL(https://www.youtube.com)から始まるリンクのみ」のため)。
 * linkフィールドが欠けている項目は例外にせずスキップする。
 */
export function extractYoutubeLinksFromSearchItems(items: Array<{ link?: string }>): string[] {
  return items
    .map((item) => item.link)
    .filter((link): link is string => typeof link === 'string' && link.startsWith(YOUTUBE_LINK_PREFIX));
}

/** `/neko vlink <キーワード>` の結果を表示する。0件の場合もその旨を明示する(握りつぶさない)。 */
export function formatVlinkResult(keyword: string, links: string[]): string {
  if (links.length === 0) {
    return `## YouTube動画リンク検索: 「${keyword}」\nYouTube(www.youtube.com)のリンクは見つかりませんでした`;
  }
  return [
    `## YouTube動画リンク検索: 「${keyword}」`,
    ...links.map((link) => `- ${link}`),
  ].join('\n');
}

/**
 * `/neko rubyver` の結果を表示する。/ruby-wasmページが読み込む
 * @ruby/{X.Y}-wasm-wasiのビルドライン・パッケージバージョンは静的な定数
 * (rubyWasm.tsのRUBY_WASM_BINARY_URL)から取れるが、実際のCRubyパッチ
 * バージョン(例: 3.4.2の"2"の部分)はwasmバイナリ内部にしか無く、
 * ブラウザでWASMを実際に実行しない限り(=Worker側では)取得できない。
 * そのため「取得できない」ことを隠さず明記する(推測で埋めない)。
 */
export function formatRubyWasmVersionResult(info: RubyWasmVersionInfo): string {
  return [
    '## Ruby (WASM) バージョン',
    '| 項目 | 値 |',
    '|---|---|',
    `| Rubyビルドライン | ${info.rubyBuildLine} |`,
    `| @ruby/wasm-wasi パッケージ | ${info.wasmWasiPackageVersion} |`,
    '',
    `詳細な正確なパッチバージョン(例: ${info.rubyBuildLine}.x)はWASMバイナリ内部にのみ保持されており、` +
      'ブラウザで実際にRubyを実行する /ruby-wasm ページ以外(このスラッシュコマンドを含む)からは取得できません。',
  ].join('\n');
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

export type TreeViewUpdateLogRow = {
  id: number;
  repo_name: string;
  update_source: 'scheduled' | 'manual';
  changed: number;
  executed_at: string;
};

/** tree-view更新の直近10件を、実行元と実際の変更有無が分かる表にする。 */
export function formatTreeViewUpdateLogs(rows: TreeViewUpdateLogRow[]): string {
  if (rows.length === 0) return '## tree-view 更新履歴\n更新履歴はありません。';
  return [
    '## tree-view 更新履歴（最新10件）',
    '| 実行日時(UTC) | リポジトリ | 実行元 | 結果 |',
    '|---|---|---|---|',
    ...rows.map((row) =>
      `| ${row.executed_at} | ${row.repo_name} | ${row.update_source === 'scheduled' ? 'cron' : '手動'} | ${row.changed ? '更新あり' : '変更なし'} |`
    ),
  ].join('\n');
}

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
  fetchTreeViewUpdateLogs?: () => Promise<TreeViewUpdateLogRow[]>;
  updateTreeView?: (force?: boolean, repoName?: string, dryRun?: boolean) => Promise<TreeViewUpdateOutcome>;
  clientIp?: string;
  searchShares?: (keyword: string) => Promise<AichatSearchOutcome>;
  searchCursorAgentHistory?: (keyword: string) => Promise<CursorAgentCsearchOutcome>;
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
  repositoryTree?: (repoFullName: string, depth: number, options?: TreeFormatOptions) => Promise<string>;
  /** `/neko msb --help` 用。microsandboxのCLI `msb` のヘルプ一覧(msb-wasm)をMarkdownで返す。msb本体の実行はできない */
  msbHelpViaWasm?: (query: string) => Promise<string>;
  generateUuid?: (version: 'v4' | 'v7') => Promise<string>;
  countdownList?: () => Promise<CountdownListItem[]>;
  fetchMlbTodaySchedule?: () => Promise<MlbTodayGame[]>;
  sqlImpactLookup?: (tableName: string) => Promise<SqlImpactCatalogRow[]>;
  pingDynamicWorker?: () => Promise<string>;
  fetchAichatSourceTotals?: () => Promise<Record<AichatSourceKey, number>>;
  /** `/neko vlink <キーワード>` 用。Googleに「YouTube <キーワード>」で検索をかけ、www.youtube.comのリンクのみを抽出して返す */
  searchYoutubeLinks?: (keyword: string) => Promise<string[]>;
  /** `/neko j <キーワード>` 用。jev_evaluationsをquestion/answerのキーワード部分一致で絞り込み、ヒット件数と各share(先頭AICHAT_JEV_KEYWORD_SCORE_LIMIT件)の1〜20ラベル個別スコアを返す */
  jevKeywordLookup?: (keyword: string) => Promise<AichatJevKeywordLookupOutcome>;
};

export type TreeViewUpdateOutcome = {
  status: 'updated' | 'recent' | 'table_missing' | 'no_repositories';
  updated: string[];
  unchanged: string[];
  failed: { repoName: string; error: string }[];
  differences?: { repoName: string; status: 'changed' | 'unchanged'; addedPaths: string[] }[];
};

export function formatTreeViewUpdateOutcome(outcome: TreeViewUpdateOutcome): string {
  if (outcome.status === 'table_missing') {
    return '❌ tree-viewの手動更新に必要なD1テーブルがありません。マイグレーションを確認してください。';
  }
  if (outcome.status === 'recent') {
    return '## tree-view 手動更新\n過去1時間以内に更新された記録があるため、手動更新をスキップしました。';
  }
  if (outcome.status === 'no_repositories') {
    return [
      '## tree-view 手動更新',
      '❌ 更新対象のリポジトリが0件のため、手動更新を実行できませんでした。',
      '元のJSONから展開済みのtree_view_snapshotsを確認してください。',
    ].join('\n');
  }
  const lines = outcome.differences ? [
    '## tree-view 差分確認',
    'GitHubの最新状態を取得し、本番DBを更新せずに差分を確認しました。',
    `- 差分あり: ${outcome.updated.length}件`,
    `- 一致: ${outcome.unchanged.length}件`,
    `- 失敗: ${outcome.failed.length}件`,
  ] : [
    '## tree-view 手動更新',
    '手動更新を実行しました。',
    `- 更新あり: ${outcome.updated.length}件`,
    `- 変更なし: ${outcome.unchanged.length}件`,
    `- 失敗: ${outcome.failed.length}件`,
  ];
  if (outcome.differences) {
    const differences = outcome.differences.filter((item) => item.status !== 'unchanged');
    lines.push(
      '',
      '### GitHub最新状態と本番DBの差分',
      `- 差分あり: ${differences.length}件`,
      `- 一致: ${outcome.differences.length - differences.length}件`,
    );
    if (differences.length > 0) {
      lines.push('', '| リポジトリ | 追加されるパス |', '|---|---|');
      for (const item of differences) {
        lines.push(...item.addedPaths.map((path) => `| ${item.repoName} | ${path} |`));
      }
    }
  }
  if (outcome.failed.length > 0) {
    lines.push('', '| リポジトリ | エラー |', '|---|---|', ...outcome.failed.map((item) => `| ${item.repoName} | ${item.error} |`));
  }
  return lines.join('\n');
}

function formatTreeViewUpdateElapsedTime(elapsedMs: number): string {
  return `実行時間: ${(Math.max(0, elapsedMs) / 1000).toFixed(3)}秒`;
}

export type SqlImpactCatalogRow = {
  queryName: string;
  command: string;
  commandConfirmed: number;
  sourceFile: string;
  sourceLine: number;
  sqlText: string;
  migrationFile: string | null;
  lastCommitHash: string | null;
  lastCommitAt: string | null;
};

function sqlImpactOperation(row: SqlImpactCatalogRow): 'read' | 'write' {
  return /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(row.sqlText) ? 'read' : 'write';
}

/** D1クエリカタログの完全一致結果を、チャット向けの短い変更影響レポートへ整形する。 */
export function formatSqlImpactReport(tableName: string, rows: SqlImpactCatalogRow[]): string {
  const catalogUrl = `/d1-query-catalog?table=${encodeURIComponent(tableName)}`;
  if (rows.length === 0) {
    return `## ${tableName} 変更影響\n関連SQLは登録されていません。\n\n詳細: ${catalogUrl}`;
  }
  const readCount = rows.filter((row) => sqlImpactOperation(row) === 'read').length;
  const writeCount = rows.length - readCount;
  const migrations = new Set(rows.map((row) => row.migrationFile).filter(Boolean));
  const unconfirmedCount = rows.filter((row) => row.commandConfirmed !== 1).length;
  const warnings: string[] = [];
  if (writeCount > 0) warnings.push(`- \`DELETE\`、\`UPDATE\`、\`INSERT\`などの書き込みクエリが${writeCount}件あります。`);
  if (unconfirmedCount > 0) warnings.push(`- ${unconfirmedCount}件のクエリでsqlcコマンド種別が推測状態です。`);
  const topRows = rows.slice(0, 8).map((row) => {
    const source = `${row.sourceFile}:${row.sourceLine}`.replace(/\|/g, '\\|');
    const commit = row.lastCommitHash
      ? `${row.lastCommitHash.slice(0, 7)}${row.lastCommitAt ? ` (${row.lastCommitAt})` : ''}`
      : '未登録';
    return `| ${row.queryName.replace(/\|/g, '\\|')} | :${row.command} | ${sqlImpactOperation(row) === 'read' ? '読み取り' : '書き込み'} | ${source} | ${commit} |`;
  });
  if (rows.length > topRows.length) warnings.push(`- 上位${topRows.length}件のみ表示しています。全件は詳細リンクで確認してください。`);
  return [
    `## ${tableName} 変更影響`,
    '',
    '| 項目 | 件数 |',
    '|---|---:|',
    `| 関連SQL | ${rows.length} |`,
    `| 読み取り処理 | ${readCount} |`,
    `| 書き込み処理 | ${writeCount} |`,
    `| 関連migration | ${migrations.size} |`,
    '',
    '### 関連SQL(上位)',
    '| クエリ名 | コマンド | 区分 | ソース | 最終変更 |',
    '|---|---|---|---|---|',
    ...topRows,
    ...(warnings.length ? ['', '### 要確認', ...warnings] : []),
    '',
    `詳細: ${catalogUrl}`,
  ].join('\n');
}

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
  // svg: サーバー側で固定パレット+数値のみから組み立てた自前生成のSVGマークアップ。
  // AI応答等の非信頼入力を一切含まないため、クライアント側はparseMd()のエスケープを
  // 経由させずそのままinnerHTMLしてよい(buildAichatSourceTotalsSvgのコメント参照)。
  | { handled: true; response: string; resultsForModal?: AichatResultItem[]; cursorResultsForModal?: CursorAgentCsearchItem[]; svg?: string }
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

  if (subcommand === 'tvlog') {
    if (!deps.fetchTreeViewUpdateLogs) {
      return { handled: true, response: '❌ /neko tvlog は現在利用できません(DB未設定)' };
    }
    try {
      return { handled: true, response: formatTreeViewUpdateLogs(await deps.fetchTreeViewUpdateLogs()) };
    } catch (err) {
      return { handled: true, response: `❌ /neko tvlog でエラーが発生しました: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (subcommand === 'tvupdate') {
    if (!deps.updateTreeView) {
      return { handled: true, response: '❌ /neko tvupdate は現在利用できません(DBまたはGitHub設定が未設定)' };
    }
    // チャットや日本語IMEを経由すると `--force` の2本のハイフンが、1文字の
    // em/en dashや全角ハイフンに置き換わることがある。見た目が同じ強制更新
    // オプションを誤って拒否しないよう、検証前にASCII表記へ揃える。
    const args = parts.slice(2).map((part) => part.normalize('NFKC').replace(/^[—–]/, '--'));
    let force = false;
    let dryRun = false;
    let repoName: string | undefined;
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if (arg.toLowerCase() === '--force' && !force) {
        force = true;
      } else if (arg.toLowerCase() === '--dryrun' && !dryRun) {
        dryRun = true;
      } else if (arg === '-R' && repoName === undefined && args[index + 1]) {
        repoName = args[++index];
      } else {
        return { handled: true, response: '❌ /neko tvupdate のオプションは --force、--dryrun と -R owner/repo を指定できます' };
      }
    }
    if (repoName !== undefined && !/^nekoserver\/[A-Za-z0-9_.-]+$/.test(repoName)) {
      return { handled: true, response: '❌ -R のリポジトリ名は nekoserver/リポジトリ名 の形式で指定してください' };
    }
    const startedAt = Date.now();
    try {
      const response = formatTreeViewUpdateOutcome(await deps.updateTreeView(force, repoName, dryRun));
      return { handled: true, response: `${response}\n${formatTreeViewUpdateElapsedTime(Date.now() - startedAt)}` };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko tvupdate でエラーが発生しました: ${err instanceof Error ? err.message : String(err)}\n${formatTreeViewUpdateElapsedTime(Date.now() - startedAt)}`,
      };
    }
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

  if (subcommand === 'sql') {
    const action = (parts[2] ?? '').toLowerCase();
    if (action !== 'impact') {
      return { handled: true, response: '❌ 書式が正しくありません: /neko sql impact <テーブル名>' };
    }
    const tableName = (parts[3] ?? '').trim();
    if (!tableName) {
      return { handled: true, response: '❌ テーブル名を指定してください: /neko sql impact <テーブル名>' };
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(tableName) || parts.length !== 4) {
      return { handled: true, response: '❌ テーブル名が不正です。英数字とアンダースコアで指定してください' };
    }
    if (!deps.sqlImpactLookup) {
      return { handled: true, response: '❌ /neko sql impact は現在利用できません(DB未設定)' };
    }
    const outcome = await raceWithTimeout(deps.sqlImpactLookup(tableName), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return { handled: true, response: `❌ /neko sql impact がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)` };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko sql impact でエラーが発生しました: ${outcome.message}` };
    }
    return { handled: true, response: formatSqlImpactReport(tableName, outcome.value) };
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

  if (subcommand === 'qsearch') {
    const keyword = parts.slice(2).join(' ').trim();
    if (!keyword) {
      return { handled: true, response: formatAichatNekoQsearchResults('', { results: [] }) };
    }
    if (!deps.searchShares) {
      return { handled: true, response: '❌ /neko qsearch は現在利用できません(過去ログ検索API未設定)' };
    }
    const outcome = await raceWithTimeout(deps.searchShares(keyword), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko qsearch がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)。データ量が多い可能性があります。時間をおいて再度お試しください。`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko qsearch でエラーが発生しました: ${outcome.message}` };
    }
    const results = mapAiChatSharesToQsearchItems(outcome.value.results);
    return {
      handled: true,
      response: formatAichatNekoQsearchResults(keyword, { results }),
    };
  }

  if (subcommand === 'csearch') {
    // スラッシュコマンド。システムコマンドではない。
    const keyword = parts.slice(2).join(' ').trim();
    if (!keyword) {
      return { handled: true, response: formatAichatNekoCsearchResults('', { results: [] }) };
    }
    if (!deps.searchCursorAgentHistory) {
      return { handled: true, response: '❌ /neko csearch は現在利用できません(Cursor VM履歴検索API未設定)' };
    }
    const outcome = await raceWithTimeout(deps.searchCursorAgentHistory(keyword), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko csearch がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)。データ量が多い可能性があります。時間をおいて再度お試しください。`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko csearch でエラーが発生しました: ${outcome.message}` };
    }
    return {
      handled: true,
      response: formatAichatNekoCsearchResults(keyword, outcome.value),
      cursorResultsForModal: outcome.value.results.length > 0 ? outcome.value.results : undefined,
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

  if (subcommand === 'j') {
    const keyword = parts.slice(2).join(' ').trim();
    if (!keyword) {
      return { handled: true, response: formatJevKeywordLookup('', { hitCount: 0, results: [] }) };
    }
    if (!deps.jevKeywordLookup) {
      return { handled: true, response: '❌ /neko j は現在利用できません(Jevキーワード検索API未設定)' };
    }
    const outcome = await raceWithTimeout(deps.jevKeywordLookup(keyword), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko j がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)。データ量が多い可能性があります。時間をおいて再度お試しください。`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko j でエラーが発生しました: ${outcome.message}` };
    }
    return { handled: true, response: formatJevKeywordLookup(keyword, outcome.value) };
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

  if (subcommand === 'kana') {
    const target = parts.slice(2).join(' ').trim();
    if (!target) {
      return { handled: true, response: '❌ 変換する文字列を指定してください: /neko kana <全角カナ>' };
    }
    return { handled: true, response: formatKanaConvertResult(target, convertZenkakuKatakanaToHankaku(target)) };
  }

  if (subcommand === 'aireqst') {
    if (!deps.fetchAichatSourceTotals) {
      return { handled: true, response: '❌ /neko aireqst は現在利用できません(DB未設定)' };
    }
    const outcome = await raceWithTimeout(deps.fetchAichatSourceTotals(), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return { handled: true, response: `❌ /neko aireqst がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)` };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko aireqst でエラーが発生しました: ${outcome.message}` };
    }
    return {
      handled: true,
      response: formatAichatSourceTotals(outcome.value),
      svg: buildAichatSourceTotalsSvg(outcome.value) ?? undefined,
    };
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

  if (subcommand === 'tree') {
    const args = parts.slice(2);
    const repoArg = args[0];
    if (!repoArg) {
      return { handled: true, response: '❌ リポジトリを指定してください: /neko tree <owner/repo> [--depth 1-4]' };
    }
    let depth = 2;
    const treeOptions: TreeFormatOptions = {};
    for (let i = 1; i < args.length; i++) {
      // IMEなどがASCIIの`--`をem/en dashへ置換しても受け付ける。
      const option = args[i].replace(/^[—–]/, '--');
      const depthWithEquals = option.match(/^(?:--depth|-d)=(.*)$/);
      if (option === '--depth' || option === '-d' || depthWithEquals) {
        const value = depthWithEquals ? depthWithEquals[1] : args[++i];
        if (!value || !/^[1-4]$/.test(value)) {
          return { handled: true, response: '❌ --depth は1から4の整数で指定してください' };
        }
        depth = Number(value);
      } else if (option === '--files-only' || option === '-f') {
        treeOptions.filesOnly = true;
      } else if (option === '--dirs-only') {
        treeOptions.directoriesOnly = true;
      } else if (option === '--hidden' || option === '-a') {
        treeOptions.includeHidden = true;
      } else if (option === '--reverse' || option === '-r') {
        treeOptions.reverse = true;
      } else if (option === '--time' || option === '-t') {
        treeOptions.sort = 'time';
      } else if (option === '--pattern' || option === '-P' || /^(?:--pattern|-P)=/.test(option)) {
        const value = option.includes('=') ? option.slice(option.indexOf('=') + 1) : args[++i];
        if (!value || value.length > 100) return { handled: true, response: '❌ --pattern は1〜100文字で指定してください' };
        treeOptions.pattern = value;
      } else if (option === '--sort' || /^--sort=/.test(option)) {
        const value = option.includes('=') ? option.slice(option.indexOf('=') + 1) : args[++i];
        if (value !== 'name' && value !== 'time') return { handled: true, response: '❌ --sort は name または time を指定してください' };
        treeOptions.sort = value;
      } else {
        return { handled: true, response: `❌ 不明なオプションです: ${args[i]}\n書式: /neko tree <owner/repo> [--depth 1-4] [--pattern glob] [--files-only|--dirs-only] [--hidden] [--sort name|time] [--reverse]` };
      }
    }
    if (treeOptions.filesOnly && treeOptions.directoriesOnly) {
      return { handled: true, response: '❌ --files-only と --dirs-only は同時に指定できません' };
    }
    if (!deps.repositoryTree) {
      return { handled: true, response: '❌ /neko tree は現在利用できません(WASM未設定)' };
    }
    try {
      const response = Object.keys(treeOptions).length
        ? await deps.repositoryTree(repoArg, depth, treeOptions)
        : await deps.repositoryTree(repoArg, depth);
      return { handled: true, response };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko tree の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'msb') {
    const args = parts.slice(2);
    // IMEやスマート入力がASCIIの`--`をem/en dashへ置換しても、helpとして扱う。
    const firstArg = (args[0] ?? '').replace(/^[—–]/, '--');
    if (args.length === 0 || firstArg === '--help' || firstArg === '-h') {
      if (!deps.msbHelpViaWasm) {
        return { handled: true, response: '❌ /neko msb --help は現在利用できません(WASM未設定)' };
      }
      try {
        const markdown = await deps.msbHelpViaWasm('');
        return { handled: true, response: ['## /neko msb --help', markdown].join('\n') };
      } catch (err) {
        return {
          handled: true,
          response: `❌ /neko msb --help の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
    return {
      handled: true,
      response: '❌ 対応しているコマンドは /neko msb --help のみです(msb本体の実行はできません。KVM等のOS仮想化に依存するためWASMでは動きません)',
    };
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

  if (subcommand === 'hellodw') {
    if (!deps.pingDynamicWorker) {
      return { handled: true, response: '❌ /neko hellodw は現在利用できません(ダイナミックWorker連携未設定)' };
    }
    const outcome = await raceWithTimeout(deps.pingDynamicWorker(), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko hellodw がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko hellodw でエラーが発生しました: ${outcome.message}` };
    }
    return { handled: true, response: formatDynamicWorkerPingResult(outcome.value) };
  }

  if (subcommand === 'rubyver') {
    try {
      return { handled: true, response: formatRubyWasmVersionResult(getRubyWasmVersionInfo()) };
    } catch (err) {
      return {
        handled: true,
        response: `❌ /neko rubyver の実行中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (subcommand === 'vlink') {
    const keyword = parts.slice(2).join(' ').trim();
    if (!keyword) {
      return { handled: true, response: '❌ キーワードを指定してください: /neko vlink <キーワード>' };
    }
    if (!deps.searchYoutubeLinks) {
      return { handled: true, response: '❌ /neko vlink は現在利用できません(Google検索API未設定)' };
    }
    const outcome = await raceWithTimeout(deps.searchYoutubeLinks(keyword), AICHAT_SEARCH_TIMEOUT_MS);
    if (outcome.status === 'timeout') {
      return {
        handled: true,
        response: `❌ /neko vlink がタイムアウトしました(${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答がありませんでした)`,
      };
    }
    if (outcome.status === 'error') {
      return { handled: true, response: `❌ /neko vlink でエラーが発生しました: ${outcome.message}` };
    }
    return { handled: true, response: formatVlinkResult(keyword, outcome.value) };
  }

  if (subcommand === 'help') {
    return { handled: true, response: formatAichatSlashCommandHelp() };
  }

  return {
    handled: true,
    response: `❌ 未対応のサブコマンドです: ${subcommand}\n利用可能なコマンド: /neko hms, /neko epoch, /neko ip, /neko cal, /neko fymd, /neko clog, /neko sessions, /neko limit, /neko uuidgen4, /neko uuidgen7, /neko search, /neko qsearch, /neko csearch, /neko s, /neko vcount, /neko j, /neko tokens, /neko tcheck, /neko 256, /neko factor, /neko dig, /neko ls, /neko gh, /neko tree, /neko msb, /neko tlist, /neko mlb, /neko hellodw, /neko rubyver, /neko vlink, /neko help\n詳細は /neko help を実行してください`,
  };
}
