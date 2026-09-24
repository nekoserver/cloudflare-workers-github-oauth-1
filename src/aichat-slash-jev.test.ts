import { describe, expect, it } from 'vitest';
import { formatJevCreditsResult, interpretAichatSlashCommand } from './utils/aichatSlashCommand';

describe('/neko jev', () => {
  it('fetchJevCreditsの結果から残クレジット・残トークンを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko jev', new Date('2026-09-24T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      fetchJevCredits: async () => ({ creditsRemainingUsd: 4.999974, paidInputTokensRemaining: 119998172 }),
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('4.999974');
    expect(result.response).toContain('119998172');
    expect(result.response).toContain('Jev');
  });

  it('fetchJevCreditsが例外を投げればエラーメッセージを表示する(握りつぶさない)', async () => {
    const result = await interpretAichatSlashCommand('/neko jev', new Date('2026-09-24T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      fetchJevCredits: async () => {
        throw new Error('HTTP 401 Unauthorized');
      },
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('HTTP 401 Unauthorized');
  });

  it('fetchJevCredits未設定時は利用不可メッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko jev', new Date('2026-09-24T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('現在利用できません');
  });

  it('タイムアウト時はタイムアウトメッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko jev', new Date('2026-09-24T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      fetchJevCredits: () => new Promise(() => {}),
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
  }, 10000);

  it('未対応コマンドのヘルプに /neko jev を含める', async () => {
    const result = await interpretAichatSlashCommand('/neko unknown', new Date('2026-09-24T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko jev');
  });

  it('formatJevCreditsResult: 残クレジット・残トークンをMarkdownで表示する', () => {
    const text = formatJevCreditsResult({ creditsRemainingUsd: 1.23, paidInputTokensRemaining: 456 });
    expect(text).toContain('1.23');
    expect(text).toContain('456');
    expect(text).toContain('Jev');
  });
});
