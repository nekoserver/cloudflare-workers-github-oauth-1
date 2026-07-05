import { describe, it, expect, vi } from 'vitest';
import {
  formatJstDateTime,
  formatJstMonthCalendar,
  formatCommitAgentLogEntry,
  interpretAichatSlashCommand,
  type CommitAgentLogRow,
} from './aichatSlashCommand';

describe('formatJstDateTime', () => {
  it('UTCの時刻をJST(UTC+9)に変換して返す', () => {
    expect(formatJstDateTime(new Date('2026-07-05T01:02:03Z'))).toBe('2026-07-05 10:02:03');
  });

  it('UTC+9で日付が繰り上がる場合も正しく変換する', () => {
    expect(formatJstDateTime(new Date('2026-07-05T20:00:00Z'))).toBe('2026-07-06 05:00:00');
  });

  it('秒までゼロ埋めで2桁表示する', () => {
    expect(formatJstDateTime(new Date('2026-01-01T00:00:05Z'))).toBe('2026-01-01 09:00:05');
  });
});

describe('formatJstMonthCalendar', () => {
  it('当月のカレンダーをMarkdownテーブルで組み立て、今日のマスを太字にする（2026年7月5日=日曜始まり）', () => {
    const result = formatJstMonthCalendar(new Date('2026-07-05T01:02:03Z'));
    const expected = [
      '2026年7月',
      '| 日 | 月 | 火 | 水 | 木 | 金 | 土 |',
      '|---|---|---|---|---|---|---|',
      '|  |  |  | 1 | 2 | 3 | 4 |',
      '| **5** | 6 | 7 | 8 | 9 | 10 | 11 |',
      '| 12 | 13 | 14 | 15 | 16 | 17 | 18 |',
      '| 19 | 20 | 21 | 22 | 23 | 24 | 25 |',
      '| 26 | 27 | 28 | 29 | 30 | 31 |  |',
    ].join('\n');
    expect(result).toBe(expected);
  });

  it('罫線・ツリー文字を使わずMarkdownテーブルで表現する（CLAUDE.mdルール16）', () => {
    const result = formatJstMonthCalendar(new Date('2026-07-05T01:02:03Z'));
    expect(result).not.toMatch(/[├└│─┼]/);
  });
});

describe('formatCommitAgentLogEntry', () => {
  it('コミット情報をMarkdownのコードブロックで表示する', () => {
    const row: CommitAgentLogRow = {
      commit_sha: '777e1244514614755f2cc33039ed2650103d10a',
      commit_message: 'fix: 何かを直した\n\n詳細説明の本文',
      detected_agent_name: 'Claude Code',
      created_at: '2026-04-05T07:19:19.047Z',
    };
    const result = formatCommitAgentLogEntry(row);
    expect(result).toBe([
      '```',
      'sha: 777e1244514614755f2cc33039ed2650103d10a',
      'message: fix: 何かを直した',
      'agent: Claude Code',
      'created_at: 2026-04-05T07:19:19.047Z',
      '```',
    ].join('\n'));
  });

  it('detected_agent_name が null の場合は (未検出) と表示する', () => {
    const row: CommitAgentLogRow = {
      commit_sha: 'abc123',
      commit_message: 'chore: update',
      detected_agent_name: null,
      created_at: '2026-04-05T07:19:19.047Z',
    };
    const result = formatCommitAgentLogEntry(row);
    expect(result).toContain('agent: (未検出)');
  });

  it('行が無い場合はその旨を返す（握りつぶさない）', () => {
    const result = formatCommitAgentLogEntry(null);
    expect(result).toBe('commit_agent_log に記録がありません');
  });

  it('コミットメッセージの先頭行のみを表示する（複数行の本文は含めない）', () => {
    const row: CommitAgentLogRow = {
      commit_sha: 'abc123',
      commit_message: '一行目\n二行目\n三行目',
      detected_agent_name: null,
      created_at: '2026-01-01T00:00:00.000Z',
    };
    const result = formatCommitAgentLogEntry(row);
    expect(result).toContain('message: 一行目');
    expect(result).not.toContain('二行目');
  });
});

describe('interpretAichatSlashCommand', () => {
  const now = new Date('2026-07-05T01:02:03Z');
  const unusedDeps = { fetchLatestCommitAgentLog: vi.fn().mockRejectedValue(new Error('should not be called')) };

  it('/neko で始まらないメッセージは通常のAI問い合わせに委ねる（handled: false）', async () => {
    expect(await interpretAichatSlashCommand('こんにちは', now, unusedDeps)).toEqual({ handled: false });
    expect(await interpretAichatSlashCommand('/pts f1', now, unusedDeps)).toEqual({ handled: false });
  });

  it('/neko hms は現在時刻(JST)をそのまま返す（プレフィックスなし）', async () => {
    const result = await interpretAichatSlashCommand('/neko hms', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '2026-07-05 10:02:03' });
  });

  it('大文字小文字を区別しない', async () => {
    const result = await interpretAichatSlashCommand('/NEKO HMS', now, unusedDeps);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toBe('2026-07-05 10:02:03');
  });

  it('前後の空白・連続空白を許容する', async () => {
    const result = await interpretAichatSlashCommand('  /neko   hms  ', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '2026-07-05 10:02:03' });
  });

  it('/neko cal は当月カレンダーをMarkdownテーブルで返す', async () => {
    const result = await interpretAichatSlashCommand('/neko cal', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: formatJstMonthCalendar(now) });
  });

  it('/neko clog は fetchLatestCommitAgentLog の結果をMarkdownコードブロックで返す', async () => {
    const row: CommitAgentLogRow = {
      commit_sha: '777e1244514614755f2cc33039ed2650103d10a',
      commit_message: 'fix: something',
      detected_agent_name: null,
      created_at: '2026-04-05T07:19:19.047Z',
    };
    const deps = { fetchLatestCommitAgentLog: vi.fn().mockResolvedValue(row) };
    const result = await interpretAichatSlashCommand('/neko clog', now, deps);
    expect(deps.fetchLatestCommitAgentLog).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ handled: true, response: formatCommitAgentLogEntry(row) });
  });

  it('/neko clog でデータが無い場合はその旨を返す（握りつぶさない）', async () => {
    const deps = { fetchLatestCommitAgentLog: vi.fn().mockResolvedValue(null) };
    const result = await interpretAichatSlashCommand('/neko clog', now, deps);
    expect(result).toEqual({ handled: true, response: 'commit_agent_log に記録がありません' });
  });

  it('未対応のサブコマンドはエラーメッセージを返す（握りつぶさない）', async () => {
    const result = await interpretAichatSlashCommand('/neko unknown', now, unusedDeps);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toContain('unknown');
    expect((result as { response: string }).response).toContain('/neko hms');
    expect((result as { response: string }).response).toContain('/neko cal');
    expect((result as { response: string }).response).toContain('/neko clog');
  });

  it('サブコマンド無指定もエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko', now, unusedDeps);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toContain('(なし)');
  });
});
