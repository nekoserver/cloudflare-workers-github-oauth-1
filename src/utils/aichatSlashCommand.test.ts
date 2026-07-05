import { describe, it, expect } from 'vitest';
import { formatJstDateTime, formatJstMonthCalendar, interpretAichatSlashCommand } from './aichatSlashCommand';

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

describe('interpretAichatSlashCommand', () => {
  const now = new Date('2026-07-05T01:02:03Z');

  it('/neko で始まらないメッセージは通常のAI問い合わせに委ねる（handled: false）', () => {
    expect(interpretAichatSlashCommand('こんにちは', now)).toEqual({ handled: false });
    expect(interpretAichatSlashCommand('/pts f1', now)).toEqual({ handled: false });
  });

  it('/neko hms は現在時刻(JST)をそのまま返す（プレフィックスなし）', () => {
    const result = interpretAichatSlashCommand('/neko hms', now);
    expect(result).toEqual({ handled: true, response: '2026-07-05 10:02:03' });
  });

  it('大文字小文字を区別しない', () => {
    const result = interpretAichatSlashCommand('/NEKO HMS', now);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toBe('2026-07-05 10:02:03');
  });

  it('前後の空白・連続空白を許容する', () => {
    const result = interpretAichatSlashCommand('  /neko   hms  ', now);
    expect(result).toEqual({ handled: true, response: '2026-07-05 10:02:03' });
  });

  it('/neko cal は当月カレンダーをMarkdownテーブルで返す', () => {
    const result = interpretAichatSlashCommand('/neko cal', now);
    expect(result).toEqual({ handled: true, response: formatJstMonthCalendar(now) });
  });

  it('未対応のサブコマンドはエラーメッセージを返す（握りつぶさない）', () => {
    const result = interpretAichatSlashCommand('/neko unknown', now);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toContain('unknown');
    expect((result as { response: string }).response).toContain('/neko hms');
    expect((result as { response: string }).response).toContain('/neko cal');
  });

  it('サブコマンド無指定もエラーメッセージを返す', () => {
    const result = interpretAichatSlashCommand('/neko', now);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toContain('(なし)');
  });
});
