import { describe, expect, it } from 'vitest';
import {
  CURSOR_AGENT_ALLOWED_REPOS,
  validateCursorAgentLaunchRequest,
  formatCursorAgentValidationError,
  buildCursorAgentRequestBody,
  buildCursorAgentStatusUrl,
  extractCursorAgentId,
  extractCursorAgentSummaryText,
  extractCursorAgentFields,
  buildCursorAgentConversationUrl,
  extractCursorAgentConversationAnswers,
  mergeCursorAgentConversationAnswers,
  normalizeCursorAgentHistorySearchQuery,
  buildCursorAgentHistoryListSql,
  buildCursorAgentHistorySearchBinds,
  CURSOR_AGENT_HISTORY_SEARCH_QUERY_BIND_COUNT,
  CURSOR_AGENT_HISTORY_SEARCH_QUERY_BIND_COUNT_WITHOUT_CACHE,
  isCursorAgentAnswerCacheMissingError,
  queryCursorAgentHistoryWithSearch,
  buildCursorAgentAnswerCacheCountSql,
  isCursorAgentSuccessfulTerminal,
  buildCursorAgentSearchLogUpsertSql,
  buildCursorAgentSearchHistoryInsertSql,
  persistCursorAgentPastLogHits,
  type CursorAgentLaunchInput,
} from './cursorAgentLaunch';

// 対象: /cursor-agent ページ・POST /api/cursor-agent/launch。
// Cursor Background Agent API (POST https://api.cursor.com/v1/agents) を
// フォーム入力(プロンプト・対象リポジトリ)から起動する前の入力チェック。
//
// 故障シナリオ:
//   (1) CURSOR_API_KEY未設定のまま実行され、Cursor APIへ空/不正な認証情報で
//       リクエストしてしまう(APIキー漏洩・無駄なAPI呼び出しにつながる)
//   (2) プロンプトが1文字以下(空文字含む)でも実行されてしまう
//   (3) 対象リポジトリがセレクトボックスの許可リストに無い値でも実行されてしまう
//       (URL欄が実質フリー入力化し、任意のGitHubリポジトリに対してAgentを
//       起動できてしまう権限昇格になる)
//   (4) 複数の条件が同時に欠けている場合に、どれか1つしかエラーを検出しない

function validInput(overrides: Partial<CursorAgentLaunchInput> = {}): CursorAgentLaunchInput {
  return {
    hasApiKey: true,
    prompt: 'READMEのタイポを直して',
    repoFullName: 'nekoserver/cloudflare-workers-github-oauth-1',
    allowedRepos: CURSOR_AGENT_ALLOWED_REPOS,
    ...overrides,
  };
}

describe('validateCursorAgentLaunchRequest', () => {
  it('全条件を満たせばok:trueを返す', () => {
    expect(validateCursorAgentLaunchRequest(validInput())).toEqual({ ok: true });
  });

  it('CURSOR_API_KEY未設定ならmissing_api_keyで拒否する', () => {
    const result = validateCursorAgentLaunchRequest(validInput({ hasApiKey: false }));
    expect(result).toEqual({ ok: false, errorCode: 'missing_api_key' });
  });

  it('プロンプトが空文字ならprompt_too_shortで拒否する', () => {
    const result = validateCursorAgentLaunchRequest(validInput({ prompt: '' }));
    expect(result).toEqual({ ok: false, errorCode: 'prompt_too_short' });
  });

  it('プロンプトが1文字だけならprompt_too_shortで拒否する(1文字以下)', () => {
    const result = validateCursorAgentLaunchRequest(validInput({ prompt: 'A' }));
    expect(result).toEqual({ ok: false, errorCode: 'prompt_too_short' });
  });

  it('プロンプトが前後空白のみ(トリム後0文字)ならprompt_too_shortで拒否する', () => {
    const result = validateCursorAgentLaunchRequest(validInput({ prompt: '   ' }));
    expect(result).toEqual({ ok: false, errorCode: 'prompt_too_short' });
  });

  it('プロンプトが2文字以上ならプロンプト起因では拒否されない', () => {
    const result = validateCursorAgentLaunchRequest(validInput({ prompt: 'AB' }));
    expect(result).toEqual({ ok: true });
  });

  it('対象リポジトリが許可リストに無ければrepo_not_allowedで拒否する', () => {
    const result = validateCursorAgentLaunchRequest(validInput({ repoFullName: 'someone/unknown-repo' }));
    expect(result).toEqual({ ok: false, errorCode: 'repo_not_allowed' });
  });

  it('対象リポジトリが未指定(空文字)ならrepo_not_allowedで拒否する', () => {
    const result = validateCursorAgentLaunchRequest(validInput({ repoFullName: '' }));
    expect(result).toEqual({ ok: false, errorCode: 'repo_not_allowed' });
  });

  it('複数条件が同時に欠けていてもエラーにならず落ちない(いずれか1つを検出できる)', () => {
    const result = validateCursorAgentLaunchRequest(
      validInput({ hasApiKey: false, prompt: '', repoFullName: 'unknown/repo' })
    );
    expect(result.ok).toBe(false);
  });
});

describe('formatCursorAgentValidationError', () => {
  it('missing_api_keyの案内文にCURSOR_API_KEYを含める', () => {
    expect(formatCursorAgentValidationError('missing_api_key')).toContain('CURSOR_API_KEY');
  });

  it('prompt_too_shortの案内文にプロンプトへの言及を含める', () => {
    expect(formatCursorAgentValidationError('prompt_too_short')).toContain('プロンプト');
  });

  it('repo_not_allowedの案内文にリポジトリへの言及を含める', () => {
    expect(formatCursorAgentValidationError('repo_not_allowed')).toContain('リポジトリ');
  });

  it('罫線・ツリー文字を使わない(CLAUDE.mdルール16)', () => {
    expect(formatCursorAgentValidationError('missing_api_key')).not.toMatch(/[├└│─┼]/);
  });
});

describe('buildCursorAgentRequestBody', () => {
  it('Cursor Agents APIの仕様通りのbodyを組み立てる(model=grok-4.6, effort=high, fast=true)', () => {
    const body = buildCursorAgentRequestBody('READMEのタイポを直して', 'nekoserver/cloudflare-workers-github-oauth-1');
    expect(body).toEqual({
      prompt: { text: 'READMEのタイポを直して' },
      model: {
        id: 'grok-4.6',
        params: [
          { id: 'effort', value: 'high' },
          { id: 'fast', value: 'true' },
        ],
      },
      repos: [
        {
          url: 'https://github.com/nekoserver/cloudflare-workers-github-oauth-1',
          startingRef: 'main',
        },
      ],
    });
  });

  it('プロンプトはトリムしてから埋め込む', () => {
    const body = buildCursorAgentRequestBody('  猫を直して  ', 'nekoserver/cloudflare-workers-github-oauth-1');
    expect(body.prompt.text).toBe('猫を直して');
  });
});

describe('buildCursorAgentStatusUrl', () => {
  it('GET /v1/agents/{id}のURLを組み立てる(起動後の最新状態・結果を取得し直すため)', () => {
    expect(buildCursorAgentStatusUrl('bc-123')).toBe('https://api.cursor.com/v1/agents/bc-123');
  });

  it('agent_idをURLエンコードする', () => {
    expect(buildCursorAgentStatusUrl('bc/../123')).toBe('https://api.cursor.com/v1/agents/bc%2F..%2F123');
  });
});

describe('extractCursorAgentId', () => {
  it('実際のCursor APIレスポンス(agent.id配下にネスト)からagent_idを抽出する', () => {
    // 2026-09-13にユーザーが実際の起動結果として貼った応答実物の形。
    // トップレベルにはid・statusは無く、agentキーの下にネストされている。
    const response = {
      agent: { id: 'bc-fa8faa81-4719-404e-8f45-6ab923475169', name: '日次報告', status: 'ACTIVE' },
      run: { id: 'run-6c1b893b-5798-444b-a8fa-6c1354fd6d0b', status: 'RUNNING' },
    };
    expect(extractCursorAgentId(response)).toBe('bc-fa8faa81-4719-404e-8f45-6ab923475169');
  });

  it('agentキー自体が無い場合はnullを返す(存在しないものをでっち上げない)', () => {
    expect(extractCursorAgentId({})).toBeNull();
    expect(extractCursorAgentId(null)).toBeNull();
    expect(extractCursorAgentId({ run: { id: 'run-1' } })).toBeNull();
  });

  it('agent.idが文字列でない場合はnullを返す', () => {
    expect(extractCursorAgentId({ agent: { id: 123 } })).toBeNull();
    expect(extractCursorAgentId({ agent: {} })).toBeNull();
    expect(extractCursorAgentId({ agent: null })).toBeNull();
  });

  it('トップレベルにidがあるだけの誤った形(旧実装が想定していた形)ではnullを返す(agent.id以外は信用しない)', () => {
    expect(extractCursorAgentId({ id: 'bc-123', status: 'CREATING' })).toBeNull();
  });
});

describe('extractCursorAgentSummaryText', () => {
  // Cursor公式ドキュメント・フォーラムの実例(2026-09-14 Web検索で確認)により、
  // Cloud Agents APIの完了イベントは `{ runId, status: "FINISHED", text: "...",
  // durationMs, git }` の形でrun.textにレポート本文が入ることが確認できた
  // (forum.cursor.com "Cloud Agents API doesn't provide summary"より)。
  // 一方agent.summaryは「computer use更新後、応答から抜け落ちることがある」
  // という既知の不具合が報告されているため、run.textを最優先にし、
  // agent.summaryはフォールバックとして残す。
  it('run.textを最優先で返す(Cursor公式の完了イベント実例で確認済み)', () => {
    const response = { agent: { summary: 'agent側の要約' }, run: { status: 'FINISHED', text: '昨日のコミットは3件でした' } };
    expect(extractCursorAgentSummaryText(response)).toBe('昨日のコミットは3件でした');
  });

  it('run.textが無ければagent.summaryを返す(既知の不具合でrun.textが欠ける場合のフォールバック)', () => {
    const response = { agent: { summary: '昨日のコミットは3件でした', result: '別の内容' } };
    expect(extractCursorAgentSummaryText(response)).toBe('昨日のコミットは3件でした');
  });

  it('agent.summaryも無ければagent.resultを返す', () => {
    const response = { agent: { result: '結果テキスト' } };
    expect(extractCursorAgentSummaryText(response)).toBe('結果テキスト');
  });

  it('agent配下に無ければagent.output、それも無ければagent.reportを探す', () => {
    expect(extractCursorAgentSummaryText({ agent: { output: '出力テキスト' } })).toBe('出力テキスト');
    expect(extractCursorAgentSummaryText({ agent: { report: 'レポートテキスト' } })).toBe('レポートテキスト');
  });

  it('agent配下に見つからなければトップレベルのtext・summary・run.summaryも探す', () => {
    expect(extractCursorAgentSummaryText({ text: 'トップレベルのtext' })).toBe('トップレベルのtext');
    expect(extractCursorAgentSummaryText({ summary: 'トップレベルの要約' })).toBe('トップレベルの要約');
    expect(extractCursorAgentSummaryText({ run: { summary: 'runの要約' } })).toBe('runの要約');
  });

  it('該当フィールドが1つも無ければnullを返す(でっち上げない)', () => {
    expect(extractCursorAgentSummaryText({ agent: { id: 'bc-1', status: 'RUNNING' } })).toBeNull();
    expect(extractCursorAgentSummaryText({})).toBeNull();
    expect(extractCursorAgentSummaryText(null)).toBeNull();
  });

  it('該当フィールドが空文字・非文字列の場合はでっち上げず次の候補を探す', () => {
    expect(extractCursorAgentSummaryText({ run: { text: '' }, agent: { summary: '', result: '結果テキスト' } })).toBe('結果テキスト');
    expect(extractCursorAgentSummaryText({ agent: { summary: 123 } })).toBeNull();
  });
});

// 対象: cursor_agent_launch_log・cursor_agent_status_logへJSONブロブのまま
// 記録するのではなく、意味のある項目(id・name・status・url・run状態・
// レポート本文)を個別カラムへ切り出して保存するための一括抽出関数。
describe('extractCursorAgentFields', () => {
  it('agent/run配下の各フィールドを1回でまとめて抽出する', () => {
    const response = {
      agent: {
        id: 'bc-1',
        name: '日次報告',
        status: 'FINISHED',
        url: 'https://cursor.com/agents/bc-1',
        summary: '昨日のコミットは3件でした',
      },
      run: { status: 'COMPLETED' },
    };
    expect(extractCursorAgentFields(response)).toEqual({
      id: 'bc-1',
      name: '日次報告',
      status: 'FINISHED',
      url: 'https://cursor.com/agents/bc-1',
      runStatus: 'COMPLETED',
      reportText: '昨日のコミットは3件でした',
    });
  });

  it('httpsで始まらないurlは信用せずnullにする', () => {
    const result = extractCursorAgentFields({ agent: { id: 'bc-1', url: 'javascript:alert(1)' } });
    expect(result.url).toBeNull();
  });

  it('各フィールドが欠けていてもでっち上げず、該当項目だけnullにする', () => {
    expect(extractCursorAgentFields({})).toEqual({
      id: null, name: null, status: null, url: null, runStatus: null, reportText: null,
    });
    expect(extractCursorAgentFields(null)).toEqual({
      id: null, name: null, status: null, url: null, runStatus: null, reportText: null,
    });
  });
});

// 対象: GET /v0/agents/{id}/conversation。Cursorアプリ
// (https://cursor.com/agents/{id})の会話に載っている回答文を、
// Agent IDタップ時の最上位モーダルへ埋め込むために取得する。
//
// 故障シナリオ:
//   (1) agent_idをそのままURLに埋め込み、パス区切りを含む値で別リソースへ
//       リクエストしてしまう
//   (2) user_messageを回答文として採用してしまう(質問を回答と誤表示)
//   (3) 空文字・非文字列のtextを回答としてでっち上げる
//   (4) messagesが無い・配列でない応答で例外を投げ、モーダル全体が壊れる
describe('buildCursorAgentConversationUrl', () => {
  it('GET /v0/agents/{id}/conversation のURLを組み立てる(アプリ画面の会話=回答文の取得先)', () => {
    expect(buildCursorAgentConversationUrl('bc-123')).toBe(
      'https://api.cursor.com/v0/agents/bc-123/conversation'
    );
  });

  it('agent_idをURLエンコードする', () => {
    expect(buildCursorAgentConversationUrl('bc/../123')).toBe(
      'https://api.cursor.com/v0/agents/bc%2F..%2F123/conversation'
    );
  });
});

describe('extractCursorAgentConversationAnswers', () => {
  it('assistant_messageのtextだけを出現順で返す(user_messageは回答ではない)', () => {
    const payload = {
      id: 'bc-123',
      messages: [
        { id: 'm1', type: 'user_message', text: 'READMEを直して' },
        { id: 'm2', type: 'assistant_message', text: 'READMEを更新しました' },
        { id: 'm3', type: 'assistant_message', text: 'インストール手順も追記しました' },
      ],
    };
    expect(extractCursorAgentConversationAnswers(payload)).toEqual([
      'READMEを更新しました',
      'インストール手順も追記しました',
    ]);
  });

  it('typeがassistantでも回答として扱う(v1系の別名)', () => {
    const payload = { messages: [{ type: 'assistant', text: '完了しました' }] };
    expect(extractCursorAgentConversationAnswers(payload)).toEqual(['完了しました']);
  });

  it('空文字・非文字列のtextは回答として採用しない', () => {
    const payload = {
      messages: [
        { type: 'assistant_message', text: '' },
        { type: 'assistant_message', text: 123 },
        { type: 'assistant_message', text: '本文' },
      ],
    };
    expect(extractCursorAgentConversationAnswers(payload)).toEqual(['本文']);
  });

  it('messagesが無い・配列でない・payloadが不正でも例外を投げず空配列を返す', () => {
    expect(extractCursorAgentConversationAnswers(null)).toEqual([]);
    expect(extractCursorAgentConversationAnswers({})).toEqual([]);
    expect(extractCursorAgentConversationAnswers({ messages: 'nope' })).toEqual([]);
    expect(extractCursorAgentConversationAnswers({ messages: [null, 1, {}] })).toEqual([]);
  });
});

// 対象: 会話APIのassistant断片を1本の回答文へまとめる。
// キャッシュには断片ごとではなく結合後の回答文だけを残す。
//
// 故障シナリオ:
//   (1) 断片を空文字やユーザー発言まで結合してしまう
//   (2) 区切りなしで連結しMarkdown見出しが壊れる
describe('mergeCursorAgentConversationAnswers', () => {
  it('複数の回答断片を空行区切りで1本にまとめる', () => {
    expect(mergeCursorAgentConversationAnswers([
      '## 完了',
      '**README**を更新しました',
    ])).toBe('## 完了\n\n**README**を更新しました');
  });

  it('空文字の断片は捨て、残った回答文だけを結合する', () => {
    expect(mergeCursorAgentConversationAnswers(['', '本文', ''])).toBe('本文');
  });

  it('断片が無いときは空文字を返す(空キャッシュとして扱う)', () => {
    expect(mergeCursorAgentConversationAnswers([])).toBe('');
  });
});

// 対象: GET /api/cursor-agent/history?q= の検索語正規化とSQL組み立て。
// 検索対象は画面上のプロンプト/リポジトリではなく
// cursor_agent_answer_cache.answer_text。
//
// 故障シナリオ:
//   (1) 空白だけの q を検索扱いして INNER JOIN し、キャッシュ未作成の履歴が消える
//   (2) 検索SQLが answer_text ではなく prompt を見る
//   (3) LIKE の %/_ をエスケープせず、意図しない広域一致になる
describe('normalizeCursorAgentHistorySearchQuery', () => {
  it('前後空白を除いた検索語を返す', () => {
    expect(normalizeCursorAgentHistorySearchQuery('  README  ')).toBe('README');
  });

  it('空・空白のみ・未指定は空文字にする(全件取得)', () => {
    expect(normalizeCursorAgentHistorySearchQuery('')).toBe('');
    expect(normalizeCursorAgentHistorySearchQuery('   ')).toBe('');
    expect(normalizeCursorAgentHistorySearchQuery(undefined)).toBe('');
    expect(normalizeCursorAgentHistorySearchQuery(null)).toBe('');
  });

  it('極端に長い検索語は200文字で切る', () => {
    expect(normalizeCursorAgentHistorySearchQuery('あ'.repeat(250))).toHaveLength(200);
  });
});

describe('buildCursorAgentHistoryListSql', () => {
  it('検索なしでは回答キャッシュをJOINしない(最新100件の自分の履歴)', () => {
    const sql = buildCursorAgentHistoryListSql(false);
    expect(sql).toContain('FROM cursor_agent_launch_log l');
    expect(sql).toContain('WHERE l.user_id = ?');
    expect(sql).not.toContain('cursor_agent_answer_cache');
    expect(sql).not.toContain('answer_text');
  });

  it('検索ありでは回答キャッシュ・プロンプト・レポート・Agent ID・リポジトリをINSTRで絞る', () => {
    const sql = buildCursorAgentHistoryListSql(true);
    expect(sql).toContain('LEFT JOIN cursor_agent_answer_cache a ON a.launch_id = l.id');
    expect(sql).toContain('instr(lower(coalesce(a.answer_text, \'\')), lower(?)) > 0');
    expect(sql).toContain('instr(lower(l.prompt), lower(?)) > 0');
    expect(sql).toContain('instr(lower(coalesce(s.report_text, \'\')), lower(?)) > 0');
    expect(sql).toContain('instr(lower(coalesce(l.agent_id, \'\')), lower(?)) > 0');
    expect(sql).toContain('instr(lower(l.repo_full_name), lower(?)) > 0');
    expect(sql).toContain('WHERE l.user_id = ?');
    expect(sql).not.toContain('INNER JOIN cursor_agent_answer_cache');
  });

  it('キャッシュJOINなしの検索SQLは画面の列だけをINSTRし、キャッシュ表名を含まない', () => {
    const sql = buildCursorAgentHistoryListSql(true, false);
    expect(sql).not.toContain('cursor_agent_answer_cache');
    expect(sql).not.toContain('answer_text');
    expect(sql).toContain('instr(lower(l.prompt), lower(?)) > 0');
    expect(sql).toContain('instr(lower(coalesce(s.report_text, \'\')), lower(?)) > 0');
    expect(sql).toContain('instr(lower(coalesce(l.agent_id, \'\')), lower(?)) > 0');
    expect(sql).toContain('instr(lower(l.repo_full_name), lower(?)) > 0');
  });
});

describe('buildCursorAgentHistorySearchBinds', () => {
  it('キャッシュありは user_id のあとに検索語を5回、なしは4回 bind する', () => {
    expect(CURSOR_AGENT_HISTORY_SEARCH_QUERY_BIND_COUNT).toBe(5);
    expect(CURSOR_AGENT_HISTORY_SEARCH_QUERY_BIND_COUNT_WITHOUT_CACHE).toBe(4);
    expect(buildCursorAgentHistorySearchBinds('user1', 'readme')).toEqual(
      ['user1', 'readme', 'readme', 'readme', 'readme', 'readme'],
    );
    expect(buildCursorAgentHistorySearchBinds('user1', 'readme', false)).toEqual(
      ['user1', 'readme', 'readme', 'readme', 'readme'],
    );
  });
});

describe('isCursorAgentAnswerCacheMissingError', () => {
  it('本番D1とnode:sqliteのキャッシュ表欠落だけを真にする', () => {
    expect(isCursorAgentAnswerCacheMissingError(
      'D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR',
    )).toBe(true);
    expect(isCursorAgentAnswerCacheMissingError('no such table: cursor_agent_answer_cache')).toBe(true);
    expect(isCursorAgentAnswerCacheMissingError('no such table: cursor_agent_search_log')).toBe(false);
    expect(isCursorAgentAnswerCacheMissingError('D1_ERROR: SQLITE_ERROR')).toBe(false);
  });
});

describe('queryCursorAgentHistoryWithSearch', () => {
  it('キャッシュ表欠落ならJOINなしで再検索し、searchErrorは残す', async () => {
    const sqls: string[] = [];
    const db = {
      prepare(sql: string) {
        sqls.push(sql);
        if (sql.includes('cursor_agent_answer_cache')) {
          throw new Error('D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR');
        }
        return {
          bind() {
            return {
              async all() {
                return { results: [{ id: 7, prompt: '表なし' }] };
              },
            };
          },
        };
      },
    };
    const result = await queryCursorAgentHistoryWithSearch<{ id: number; prompt: string }>(db, 'user1', '表なし');
    expect(result.searchError).toContain('回答キャッシュの検索に失敗しました');
    expect(result.searchError).toContain('no such table: cursor_agent_answer_cache');
    expect(result.rows).toEqual([{ id: 7, prompt: '表なし' }]);
    expect(sqls[0]).toContain('cursor_agent_answer_cache');
    expect(sqls[1]).not.toContain('cursor_agent_answer_cache');
  });

  it('キャッシュ表欠落以外の失敗は空行とsearchErrorだけ返す', async () => {
    let prepareCount = 0;
    const db = {
      prepare() {
        prepareCount += 1;
        throw new Error('D1_ERROR: database is locked');
      },
    };
    const result = await queryCursorAgentHistoryWithSearch(db, 'user1', 'readme');
    expect(result.rows).toEqual([]);
    expect(result.searchError).toContain('database is locked');
    expect(prepareCount).toBe(1);
  });

  it('フォールバック再検索も失敗したら元のsearchErrorを残し空行にする', async () => {
    const db = {
      prepare(sql: string) {
        if (sql.includes('cursor_agent_answer_cache')) {
          throw new Error('no such table: cursor_agent_answer_cache');
        }
        throw new Error('fallback boom');
      },
    };
    const result = await queryCursorAgentHistoryWithSearch(db, 'user1', 'readme');
    expect(result.rows).toEqual([]);
    expect(result.searchError).toContain('回答キャッシュの検索に失敗しました');
    expect(result.searchError).toContain('no such table: cursor_agent_answer_cache');
    expect(result.searchError).not.toContain('fallback boom');
  });
});

describe('isCursorAgentSuccessfulTerminal', () => {
  it('FINISHED/COMPLETEDだけを成功終端とする', () => {
    expect(isCursorAgentSuccessfulTerminal('FINISHED', 'COMPLETED')).toBe(true);
    expect(isCursorAgentSuccessfulTerminal('finished', null)).toBe(true);
    expect(isCursorAgentSuccessfulTerminal(null, 'COMPLETED')).toBe(true);
    expect(isCursorAgentSuccessfulTerminal('RUNNING', 'RUNNING')).toBe(false);
    expect(isCursorAgentSuccessfulTerminal('ERROR', 'FAILED')).toBe(false);
    expect(isCursorAgentSuccessfulTerminal(null, null)).toBe(false);
  });
});

describe('buildCursorAgentAnswerCacheCountSql', () => {
  it('自分の起動に紐づく回答キャッシュ件数を数える', () => {
    const sql = buildCursorAgentAnswerCacheCountSql();
    expect(sql).toContain('FROM cursor_agent_answer_cache a');
    expect(sql).toContain('INNER JOIN cursor_agent_launch_log l ON l.id = a.launch_id');
    expect(sql).toContain('WHERE l.user_id = ?');
    expect(sql).not.toContain('l.prompt');
  });
});

describe('cursor-agent過去ログ検索のSQLと保存', () => {
  it('集計テーブルは (user_id, keyword, launch_id) で UNIQUE upsert する', () => {
    const sql = buildCursorAgentSearchLogUpsertSql();
    expect(sql).toContain('INSERT INTO cursor_agent_search_log');
    expect(sql).toContain('ON CONFLICT(user_id, keyword, launch_id)');
    expect(sql).toContain('select_count = cursor_agent_search_log.select_count + 1');
  });

  it('明細テーブルは seq_num をキーワード×起動ごとに採番して追記する', () => {
    const sql = buildCursorAgentSearchHistoryInsertSql();
    expect(sql).toContain('INSERT INTO cursor_agent_search_history');
    expect(sql).toContain('seq_num');
    expect(sql).toContain('FROM cursor_agent_search_history WHERE user_id = ? AND keyword = ? AND launch_id = ?');
  });

  it('空キーワードはDBを触らず empty_keyword で返す', async () => {
    let prepared = 0;
    const db = { prepare() { prepared += 1; return { bind() { return { async run() { return {}; } }; } }; } };
    const result = await persistCursorAgentPastLogHits(db, {
      userId: 'user1', keyword: '   ', launchIds: [1], resultCount: 1, nowIso: '2026-09-14T00:00:00.000Z',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe('empty_keyword');
    expect(prepared).toBe(0);
  });
});
