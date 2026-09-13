import { describe, expect, it } from 'vitest';
import {
  CURSOR_AGENT_ALLOWED_REPOS,
  validateCursorAgentLaunchRequest,
  formatCursorAgentValidationError,
  buildCursorAgentRequestBody,
  buildCursorAgentStatusUrl,
  extractCursorAgentId,
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
