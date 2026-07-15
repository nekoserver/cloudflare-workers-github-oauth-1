import { describe, expect, it } from 'vitest';
import { formatAiToolLimitInfo, interpretAichatSlashCommand } from './utils/aichatSlashCommand';

describe('/neko limit', () => {
  it('Codex と Claude Code の5時間枠・週次枠の確認先を表示する', async () => {
    const result = await interpretAichatSlashCommand('/neko limit', new Date('2026-07-15T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('Codex');
    expect(result.response).toContain('Claude Code');
    expect(result.response).toContain('5時間');
    expect(result.response).toContain('週次');
    expect(result.response).toContain('/usage');
  });

  it('未対応コマンドのヘルプに /neko limit を含める', async () => {
    const result = await interpretAichatSlashCommand('/neko unknown', new Date('2026-07-15T00:00:00.000Z'), {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko limit');
  });

  it('formatAiToolLimitInfo が公式確認先URLを含む', () => {
    const text = formatAiToolLimitInfo(new Date('2026-07-15T00:00:00.000Z'));
    expect(text).toContain('chatgpt.com/codex/pricing');
    expect(text).toContain('support.claude.com');
  });
});
