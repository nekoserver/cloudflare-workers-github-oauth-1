import { describe, it, expect } from 'vitest';
import { formatJstDateTime, interpretAichatSlashCommand } from './aichatSlashCommand';

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

describe('interpretAichatSlashCommand', () => {
  const now = new Date('2026-07-05T01:02:03Z');

  it('/neko で始まらないメッセージは通常のAI問い合わせに委ねる（handled: false）', () => {
    expect(interpretAichatSlashCommand('こんにちは', now)).toEqual({ handled: false });
    expect(interpretAichatSlashCommand('/pts f1', now)).toEqual({ handled: false });
  });

  it('/neko hms は現在時刻(JST)を返す', () => {
    const result = interpretAichatSlashCommand('/neko hms', now);
    expect(result).toEqual({ handled: true, response: '🕐 現在時刻（JST）: 2026-07-05 10:02:03' });
  });

  it('大文字小文字を区別しない', () => {
    const result = interpretAichatSlashCommand('/NEKO HMS', now);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toContain('2026-07-05 10:02:03');
  });

  it('前後の空白・連続空白を許容する', () => {
    const result = interpretAichatSlashCommand('  /neko   hms  ', now);
    expect(result).toEqual({ handled: true, response: '🕐 現在時刻（JST）: 2026-07-05 10:02:03' });
  });

  it('未対応のサブコマンドはエラーメッセージを返す（握りつぶさない）', () => {
    const result = interpretAichatSlashCommand('/neko unknown', now);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toContain('unknown');
    expect((result as { response: string }).response).toContain('/neko hms');
  });

  it('サブコマンド無指定もエラーメッセージを返す', () => {
    const result = interpretAichatSlashCommand('/neko', now);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toContain('(なし)');
  });
});
