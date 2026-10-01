import { describe, expect, it } from 'vitest';
import { formatAskgkResult, interpretAichatSlashCommand } from './utils/aichatSlashCommand';

describe('/neko askgk', () => {
  it('askTunnelSignerのreplyをそのまま表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko askgk げんき？', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      askTunnelSigner: async (message) => {
        expect(message).toBe('げんき？');
        return 'にゃーん、元気だよ';
      },
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('げんき？');
    expect(result.response).toContain('にゃーん、元気だよ');
  });

  /** 故障シナリオ: replyに含まれる改行がMarkdown整形の過程で潰れたり
   * エスケープされたりすると、Slack側で改行なしの1行として表示されてしまう。 */
  it('replyの改行をそのまま維持する', async () => {
    const replyWithNewlines = '1行目\n2行目\n\n3行目';
    const result = await interpretAichatSlashCommand('/neko askgk x', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      askTunnelSigner: async () => replyWithNewlines,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain(replyWithNewlines);
  });

  it('質問文が無い場合はヘルプを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko askgk', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('質問文を指定してください');
  });

  it('askTunnelSignerが例外を投げればエラーメッセージを表示する(握りつぶさない)', async () => {
    const result = await interpretAichatSlashCommand('/neko askgk x', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      askTunnelSigner: async () => {
        throw new Error('secret ORIGIN_HMAC_SECRET (or HMAC_SECRET) is not configured');
      },
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('ORIGIN_HMAC_SECRET');
  });

  it('askTunnelSigner未設定時は利用不可メッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko askgk x', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('現在利用できません');
  });

  it('タイムアウト時はタイムアウトメッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko askgk x', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      askTunnelSigner: () => new Promise(() => {}),
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
  }, 10000);

  it('未対応コマンドのヘルプに /neko askgk を含める', async () => {
    const result = await interpretAichatSlashCommand('/neko unknown', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko askgk');
  });

  it('formatAskgkResult: 質問文と回答文を見出し付きMarkdownで表示する', () => {
    const text = formatAskgkResult('げんき？', 'にゃーん');
    expect(text).toContain('## /neko askgk');
    expect(text).toContain('げんき？');
    expect(text).toContain('にゃーん');
  });
});
