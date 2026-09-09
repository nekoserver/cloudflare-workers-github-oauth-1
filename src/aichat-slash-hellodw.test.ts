import { describe, expect, it } from 'vitest';
import { formatDynamicWorkerPingResult, interpretAichatSlashCommand } from './utils/aichatSlashCommand';

describe('/neko hellodw', () => {
  it('pingDynamicWorkerがworldを返せば成功メッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko hellodw', new Date('2026-09-10T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      pingDynamicWorker: async () => 'world',
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('dynamicneko');
    expect(result.response).toContain('world');
    expect(result.response).toContain('✅');
  });

  it('pingDynamicWorkerがworld以外を返せば警告表示する(握りつぶさない)', async () => {
    const result = await interpretAichatSlashCommand('/neko hellodw', new Date('2026-09-10T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      pingDynamicWorker: async () => 'unexpected',
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('⚠️');
    expect(result.response).toContain('unexpected');
  });

  it('pingDynamicWorkerが例外を投げればエラーメッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko hellodw', new Date('2026-09-10T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      pingDynamicWorker: async () => {
        throw new Error('HTTP 401');
      },
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('HTTP 401');
  });

  it('pingDynamicWorker未設定時は利用不可メッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko hellodw', new Date('2026-09-10T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('現在利用できません');
  });

  it('タイムアウト時はタイムアウトメッセージを表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko hellodw', new Date('2026-09-10T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
      pingDynamicWorker: () => new Promise(() => {}),
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
  }, 10000);

  it('未対応コマンドのヘルプに /neko hellodw を含める', async () => {
    const result = await interpretAichatSlashCommand('/neko unknown', new Date('2026-09-10T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko hellodw');
  });

  it('formatDynamicWorkerPingResult: worldなら✅を返す', () => {
    expect(formatDynamicWorkerPingResult('world')).toContain('✅');
  });

  it('formatDynamicWorkerPingResult: world以外は⚠️と実際の応答を返す', () => {
    const text = formatDynamicWorkerPingResult('goodbye');
    expect(text).toContain('⚠️');
    expect(text).toContain('goodbye');
  });
});
