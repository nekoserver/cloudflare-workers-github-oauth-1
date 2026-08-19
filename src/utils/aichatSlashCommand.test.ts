import { describe, it, expect, vi } from 'vitest';
import {
  formatJstDateTime,
  formatJstMonthCalendar,
  formatCommitAgentLogEntry,
  formatAichatSlashCommandHelp,
  formatSha256WasmResult,
  formatFactorWasmResult,
  formatDigHelp,
  formatDigResult,
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
      '| 2026年7月 |',
      '|:---:|',
      '| 日 | 月 | 火 | 水 | 木 | 金 | 土 |',
      '|---:|---:|---:|---:|---:|---:|---:|',
      '|  |  |  | 1 | 2 | 3 | 4 |',
      '| **5** | 6 | 7 | 8 | 9 | 10 | 11 |',
      '| 12 | 13 | 14 | 15 | 16 | 17 | 18 |',
      '| 19 | 20 | 21 | 22 | 23 | 24 | 25 |',
      '| 26 | 27 | 28 | 29 | 30 | 31 |  |',
    ].join('\n');
    expect(result).toBe(expected);
  });

  it('タイトルは1列の中央寄せMarkdownテーブルとして表現される', () => {
    const result = formatJstMonthCalendar(new Date('2026-07-05T01:02:03Z'));
    expect(result.split('\n').slice(0, 2)).toEqual(['| 2026年7月 |', '|:---:|']);
  });

  it('日付グリッドの区切り行は右寄せ(---:)で表現される', () => {
    const result = formatJstMonthCalendar(new Date('2026-07-05T01:02:03Z'));
    expect(result.split('\n')[3]).toBe('|---:|---:|---:|---:|---:|---:|---:|');
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

describe('formatAichatSlashCommandHelp', () => {
  it('全サブコマンドを含むヘルプを返す', () => {
    const result = formatAichatSlashCommandHelp();
    expect(result).toContain('/neko hms');
    expect(result).toContain('/neko cal');
    expect(result).toContain('/neko clog');
    expect(result).toContain('/neko limit');
    expect(result).toContain('/neko 256');
    expect(result).toContain('/neko factor');
    expect(result).toContain('/neko dig');
    expect(result).toContain('/neko help');
  });

  it('罫線・ツリー文字を使わずMarkdownテーブルで表現する（CLAUDE.mdルール16）', () => {
    const result = formatAichatSlashCommandHelp();
    expect(result).not.toMatch(/[├└│─┼]/);
  });
});

describe('formatDigHelp', () => {
  it('対応レコードタイプ・書式一覧を含むMarkdownを返す', () => {
    const result = formatDigHelp();
    expect(result).toContain('/neko dig <ドメイン>');
    expect(result).toContain('-t <タイプ>');
    expect(result).toContain('--help');
    expect(result).toContain('対応レコードタイプ');
    expect(result).toContain('AAAA');
  });

  it('罫線・ツリー文字を使わずMarkdownテーブルで表現する（CLAUDE.mdルール16）', () => {
    const result = formatDigHelp();
    expect(result).not.toMatch(/[├└│─┼]/);
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

  it('/neko help は全サブコマンドのヘルプを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko help', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: formatAichatSlashCommandHelp() });
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

  it('/neko 256 <文字列> は sha256ViaWasm の結果を表示する', async () => {
    const sha256ViaWasm = vi.fn().mockResolvedValue('abc123');
    const result = await interpretAichatSlashCommand('/neko 256 hello world', now, { ...unusedDeps, sha256ViaWasm });
    expect(sha256ViaWasm).toHaveBeenCalledWith('hello world');
    expect(result).toEqual({ handled: true, response: formatSha256WasmResult('hello world', 'abc123') });
  });

  it('/neko 256 で文字列未指定の場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const sha256ViaWasm = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko 256', now, { ...unusedDeps, sha256ViaWasm });
    expect(sha256ViaWasm).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: '❌ ハッシュ化する文字列を指定してください: /neko 256 <文字列>' });
  });

  it('/neko 256 は sha256ViaWasm 未設定時にエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko 256 hello', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ /neko 256 は現在利用できません(WASM未設定)' });
  });

  it('/neko 256 で sha256ViaWasm が例外を投げた場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const sha256ViaWasm = vi.fn().mockRejectedValue(new Error('wasm init failed'));
    const result = await interpretAichatSlashCommand('/neko 256 hello', now, { ...unusedDeps, sha256ViaWasm });
    expect(result).toEqual({ handled: true, response: '❌ /neko 256 の実行中にエラーが発生しました: wasm init failed' });
  });

  it('/neko factor <数値> は factorViaWasm の結果を表示する', async () => {
    const factorViaWasm = vi.fn().mockResolvedValue('12: 2 2 3');
    const result = await interpretAichatSlashCommand('/neko factor 12', now, { ...unusedDeps, factorViaWasm });
    expect(factorViaWasm).toHaveBeenCalledWith(12);
    expect(result).toEqual({ handled: true, response: formatFactorWasmResult('12: 2 2 3') });
  });

  it('/neko factor で数値未指定の場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const factorViaWasm = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko factor', now, { ...unusedDeps, factorViaWasm });
    expect(factorViaWasm).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: '❌ 素因数分解する整数を指定してください: /neko factor <数値>' });
  });

  it('/neko factor で非整数・負数・範囲外を指定した場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const factorViaWasm = vi.fn().mockRejectedValue(new Error('should not be called'));
    for (const bad of ['abc', '3.14', '-1', '10000000000000000']) {
      const result = await interpretAichatSlashCommand(`/neko factor ${bad}`, now, { ...unusedDeps, factorViaWasm });
      expect(result.handled).toBe(true);
      expect((result as { response: string }).response).toContain('2^53');
    }
    expect(factorViaWasm).not.toHaveBeenCalled();
  });

  it('/neko factor は0と2^53を境界値として許可する', async () => {
    const factorViaWasm = vi.fn().mockResolvedValue('mock');
    await interpretAichatSlashCommand('/neko factor 0', now, { ...unusedDeps, factorViaWasm });
    await interpretAichatSlashCommand('/neko factor 9007199254740992', now, { ...unusedDeps, factorViaWasm });
    expect(factorViaWasm).toHaveBeenCalledWith(0);
    expect(factorViaWasm).toHaveBeenCalledWith(9007199254740992);
  });

  it('/neko factor は factorViaWasm 未設定時にエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko factor 12', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ /neko factor は現在利用できません(WASM未設定)' });
  });

  it('/neko factor で factorViaWasm が例外を投げた場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const factorViaWasm = vi.fn().mockRejectedValue(new Error('wasm init failed'));
    const result = await interpretAichatSlashCommand('/neko factor 12', now, { ...unusedDeps, factorViaWasm });
    expect(result).toEqual({ handled: true, response: '❌ /neko factor の実行中にエラーが発生しました: wasm init failed' });
  });
});

describe('formatFactorWasmResult', () => {
  it('factorの結果をコードブロック付きMarkdownで表示する', () => {
    const result = formatFactorWasmResult('12: 2 2 3');
    expect(result).toBe('## factor (WASM)\n```\n12: 2 2 3\n```');
  });
});

describe('formatSha256WasmResult', () => {
  it('入力文字列とハッシュ値をMarkdownで表示する', () => {
    const result = formatSha256WasmResult('hello', 'abc123');
    expect(result).toBe('## SHA-256 (WASM)\n入力: hello\nハッシュ: abc123');
  });
});

describe('/neko dig', () => {
  const now = new Date('2026-08-18T10:00:00Z');
  const unusedDeps = { fetchLatestCommitAgentLog: vi.fn().mockRejectedValue(new Error('should not be called')) };

  it('/neko dig --help はdigLookupを呼ばずヘルプを返す', async () => {
    const digLookup = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko dig --help', now, { ...unusedDeps, digLookup });
    expect(digLookup).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: formatDigHelp() });
  });

  it('/neko dig -h もヘルプを返す', async () => {
    const digLookup = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko dig -h', now, { ...unusedDeps, digLookup });
    expect(digLookup).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: formatDigHelp() });
  });

  it('/neko dig (引数なし) もヘルプを返す', async () => {
    const digLookup = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko dig', now, { ...unusedDeps, digLookup });
    expect(digLookup).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: formatDigHelp() });
  });

  it('/neko dig <ドメイン> はデフォルトでAレコードをdigLookupに渡す', async () => {
    const digLookup = vi.fn().mockResolvedValue('dummy result');
    const result = await interpretAichatSlashCommand('/neko dig example.com', now, { ...unusedDeps, digLookup });
    expect(digLookup).toHaveBeenCalledWith('example.com', 'A');
    expect(result).toEqual({ handled: true, response: formatDigResult('dummy result') });
  });

  it('/neko dig <ドメイン> <タイプ> は指定したタイプをdigLookupに渡す(小文字も大文字化する)', async () => {
    const digLookup = vi.fn().mockResolvedValue('dummy result');
    await interpretAichatSlashCommand('/neko dig example.com mx', now, { ...unusedDeps, digLookup });
    expect(digLookup).toHaveBeenCalledWith('example.com', 'MX');
  });

  it('/neko dig -t <タイプ> <ドメイン> はdig(1)の-t書式でも動作する', async () => {
    const digLookup = vi.fn().mockResolvedValue('dummy result');
    await interpretAichatSlashCommand('/neko dig -t AAAA example.com', now, { ...unusedDeps, digLookup });
    expect(digLookup).toHaveBeenCalledWith('example.com', 'AAAA');
  });

  it('/neko dig -t だけでドメインが無い場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const digLookup = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko dig -t MX', now, { ...unusedDeps, digLookup });
    expect(digLookup).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: '❌ 書式が正しくありません: /neko dig -t <タイプ> <ドメイン>' });
  });

  it('/neko dig は digLookup 未設定時にエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko dig example.com', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ /neko dig は現在利用できません(WASM未設定)' });
  });

  it('/neko dig で digLookup が例外を投げた場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const digLookup = vi.fn().mockRejectedValue(new Error('NXDOMAIN'));
    const result = await interpretAichatSlashCommand('/neko dig no-such-domain.invalid', now, { ...unusedDeps, digLookup });
    expect(result).toEqual({ handled: true, response: '❌ /neko dig の実行中にエラーが発生しました: NXDOMAIN' });
  });
});

describe('formatDigResult', () => {
  it('digの結果をコードブロック付きMarkdownで表示する', () => {
    const result = formatDigResult(';; ANSWER SECTION:\nexample.com. 300 IN A 93.184.216.34');
    expect(result).toBe('## dig (WASM)\n```\n;; ANSWER SECTION:\nexample.com. 300 IN A 93.184.216.34\n```');
  });
});
