import { describe, expect, it, vi } from 'vitest';
import { formatAichatSlashCommandHelp, interpretAichatSlashCommand } from './utils/aichatSlashCommand';

const deps = { fetchLatestCommitAgentLog: async () => null };
const now = new Date('2026-08-25T00:00:00.000Z');

describe('interpretAichatSlashCommand: /neko tcheck', () => {
  it('nkapi_から始まるトークンを検証し、有効という判定結果を返す', async () => {
    const checkApiToken = vi.fn(async () => true);
    const result = await interpretAichatSlashCommand('/neko tcheck nkapi_valid-token', now, { ...deps, checkApiToken });

    expect(checkApiToken).toHaveBeenCalledWith('nkapi_valid-token');
    expect(result).toEqual({ handled: true, response: '✅ APIトークンは有効です。' });
  });

  it('登録されていない・失効済みなどのトークンには無効という判定結果を返す', async () => {
    const result = await interpretAichatSlashCommand('/neko tcheck nkapi_invalid-token', now, {
      ...deps,
      checkApiToken: async () => false,
    });

    expect(result).toEqual({ handled: true, response: '❌ APIトークンは無効です。' });
  });

  it.each(['/neko tcheck', '/neko tcheck invalid', '/neko tcheck nkapi_one extra'])(
    '引数が未指定または不正な場合は検証せず説明をコードブロック内に表示する: %s',
    async (message) => {
      const checkApiToken = vi.fn(async () => true);
      const result = await interpretAichatSlashCommand(message, now, { ...deps, checkApiToken });

      expect(checkApiToken).not.toHaveBeenCalled();
      expect(result.handled).toBe(true);
      expect((result as { response: string }).response).toMatch(/^```[\s\S]*\/neko tcheck <nkapi_トークン>[\s\S]*```$/);
    },
  );

  it('検証処理のエラーを握りつぶさずに返す', async () => {
    const result = await interpretAichatSlashCommand('/neko tcheck nkapi_error', now, {
      ...deps,
      checkApiToken: async () => { throw new Error('DB error'); },
    });

    expect(result).toEqual({ handled: true, response: '❌ /neko tcheck の実行中にエラーが発生しました: DB error' });
  });

  it('/neko helpにもtcheckを掲載する', () => {
    expect(formatAichatSlashCommandHelp()).toContain('/neko tcheck <nkapi_トークン>');
  });
});
