import { describe, expect, it, vi } from 'vitest';
import { formatAskgkResult, interpretAichatSlashCommand, ASKGK_TIMEOUT_MS } from './utils/aichatSlashCommand';

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
    expect(result.response).toBe('にゃーん、元気だよ');
    expect(result.saveAsAiResponse).toBe(true);
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

  /**
   * tunnel-signerファイルにそのまま渡るヘルプコマンドは「/neko askgk」(引数なし)と
   * 「/neko askgk help」の2種類(いずれもローカルではエイリアス変換せずそのまま
   * tunnel-signer経由で送る)。引数なしの場合もローカルでエラーにせず、
   * 空文字のままaskTunnelSignerへ渡して先方のヘルプ応答を表示する。
   */
  it('引数なし("/neko askgk")の場合も空文字のままtunnel-signerへ渡しヘルプ応答を表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko askgk', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      askTunnelSigner: async (message) => {
        expect(message).toBe('');
        return '利用可能なコマンド一覧...';
      },
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).not.toContain('質問文を指定してください');
    expect(result.response).toContain('利用可能なコマンド一覧...');
  });

  it('引数なしでもaskTunnelSigner未設定時は利用不可メッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko askgk', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('現在利用できません');
  });

  it('"/neko askgk help"はエイリアス変換せず"help"のままtunnel-signerへ渡る', async () => {
    const result = await interpretAichatSlashCommand('/neko askgk help', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      askTunnelSigner: async (message) => {
        expect(message).toBe('help');
        return '利用可能なコマンド一覧...';
      },
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('利用可能なコマンド一覧...');
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
    // ASKGK_TIMEOUT_MS(60秒、2026-10-04にAICHAT_SEARCH_TIMEOUT_MSから分離)を
    // 実時間で待たないよう、fake timersで即座に進める。
    vi.useFakeTimers();
    try {
      const promise = interpretAichatSlashCommand('/neko askgk x', new Date('2026-10-01T00:00:00.000Z'), {
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

  it('未対応コマンドのヘルプに /neko askgk を含める', async () => {
    const result = await interpretAichatSlashCommand('/neko unknown', new Date('2026-10-01T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko askgk');
  });

  it('本文にはreplyのみを返し、Markdownと改行を維持する', () => {
    const reply = '## 回答\n\n- 項目1\n- 項目2';
    expect(formatAskgkResult('codex_prompt="質問"', reply)).toBe(reply);
    expect(formatAskgkResult('', reply)).toBe(reply);
  });
});
