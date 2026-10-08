import { describe, expect, it, vi } from 'vitest';
import { interpretAichatSlashCommand, ASKGK_TIMEOUT_MS } from './utils/aichatSlashCommand';

// 対象: /neko secureminelog サブコマンド。/neko askgk <コマンド>の
// ASKGK_COMMAND_ALIASES(models-list→"cf ai models list"等)のような
// エイリアス変換を一切経由せず、"secureminelog"という文字列をそのままtunnel-signer
// 経由で送ることを保証する(ユーザー要望)。
describe('/neko secureminelog', () => {
  it('"secureminelog"という文字列をそのままaskTunnelSignerへ渡す(エイリアス変換しない)', async () => {
    const result = await interpretAichatSlashCommand('/neko secureminelog', new Date('2026-10-08T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      askTunnelSigner: async (message) => {
        expect(message).toBe('secureminelog');
        return { reply: 'API応答本文' };
      },
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('API応答本文');
    expect(result.saveAsAiResponse).toBe(true);
  });

  it('末尾に引数が付いていても無視し、常に"secureminelog"を送る', async () => {
    const result = await interpretAichatSlashCommand('/neko secureminelog foo bar', new Date('2026-10-08T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      askTunnelSigner: async (message) => {
        expect(message).toBe('secureminelog');
        return { reply: 'ok' };
      },
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('ok');
  });

  it('askTunnelSigner未設定時は利用不可メッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko secureminelog', new Date('2026-10-08T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('現在利用できません');
  });

  it('askTunnelSignerが例外を投げればエラーメッセージを表示する(握りつぶさない)', async () => {
    const result = await interpretAichatSlashCommand('/neko secureminelog', new Date('2026-10-08T00:00:00.000Z'), {
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

  it('タイムアウト時はタイムアウトメッセージを表示する', async () => {
    vi.useFakeTimers();
    try {
      const promise = interpretAichatSlashCommand('/neko secureminelog', new Date('2026-10-08T00:00:00.000Z'), {
        fetchLatestCommitAgentLog: async () => null,
        askTunnelSigner: () => new Promise(() => {}),
      });
      await vi.advanceTimersByTimeAsync(ASKGK_TIMEOUT_MS);
      const result = await promise;
      expect(result.handled).toBe(true);
      if (!result.handled) throw new Error('not handled');
      expect(result.response).toContain('タイムアウト');
    } finally {
      vi.useRealTimers();
    }
  });

  it('未対応コマンドのヘルプに /neko secureminelog を含める', async () => {
    const result = await interpretAichatSlashCommand('/neko unknown', new Date('2026-10-08T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko secureminelog');
  });
});
