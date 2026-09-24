import { describe, expect, it } from 'vitest';
import { interpretAichatSlashCommand } from './utils/aichatSlashCommand';

describe('/neko jev', () => {
  it('TypeSafe AI公式APIにクレジット残高取得エンドポイントが無いため、console.typesafe.aiへの案内を表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko jev', new Date('2026-09-24T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('Jev');
    expect(result.response).toContain('console.typesafe.ai');
  });

  it('未対応コマンドのヘルプに /neko jev を含める', async () => {
    const result = await interpretAichatSlashCommand('/neko unknown', new Date('2026-09-24T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko jev');
  });
});
