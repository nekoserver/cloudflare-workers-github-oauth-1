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
