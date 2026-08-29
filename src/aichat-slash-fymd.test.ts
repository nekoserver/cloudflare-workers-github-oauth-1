import { describe, expect, it } from 'vitest';
import {
  findFirstPrimeYmd,
  formatAichatSlashCommandHelp,
  interpretAichatSlashCommand,
  isPrimeInteger,
} from './utils/aichatSlashCommand';

const deps = { fetchLatestCommitAgentLog: async () => null };

describe('/neko fymd', () => {
  it('JSTの今日がYYYYMMDD素数なら今日を返す', async () => {
    const result = await interpretAichatSlashCommand('/neko fymd', new Date('2026-08-28T15:00:00.000Z'), deps);
    expect(result).toEqual({ handled: true, response: '20260829' });
  });

  it('今日が素数でなければ暦日を進め、月をまたいだ最初の素数日を返す', () => {
    expect(findFirstPrimeYmd(new Date('2024-02-28T03:00:00.000Z'))).toBe('20240323');
  });

  it('引数があっても無視する', async () => {
    const result = await interpretAichatSlashCommand('/neko fymd ignored arguments', new Date('2026-01-01T00:00:00.000Z'), deps);
    expect(result).toEqual({ handled: true, response: '20260117' });
  });

  it('素数判定とヘルプ掲載を確認する', () => {
    expect(isPrimeInteger(20260829)).toBe(true);
    expect(isPrimeInteger(20260828)).toBe(false);
    expect(formatAichatSlashCommandHelp()).toContain('| /neko fymd |');
  });
});
