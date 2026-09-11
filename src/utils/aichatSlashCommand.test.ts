import { describe, it, expect, vi } from 'vitest';
import {
  formatJstDateTime,
  formatEpochTime,
  formatJstMonthCalendar,
  formatCommitAgentLogEntry,
  formatAichatSlashCommandHelp,
  formatSha256WasmResult,
  convertZenkakuKatakanaToHankaku,
  formatKanaConvertResult,
  formatFactorWasmResult,
  formatDigHelp,
  formatDigResult,
  formatLsWasmResult,
  formatCountdownListResult,
  interpretAichatSlashCommand,
  getJstDateYmdHyphen,
  parseMlbFilterArgs,
  mlbFilterTeamIds,
  filterMlbGamesByDivision,
  formatMlbTodayScheduleResult,
  type CommitAgentLogRow,
  type MlbTodayGame,
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

describe('formatEpochTime', () => {
  it('Unixエポックからの経過秒数を返す', () => {
    expect(formatEpochTime(new Date('2026-07-05T01:02:03.999Z'))).toBe('1783213323');
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
    expect(result).toContain('/neko epoch');
    expect(result).toContain('/neko cal');
    expect(result).toContain('/neko clog');
    expect(result).toContain('/neko limit');
    expect(result).toContain('/neko 256');
    expect(result).toContain('/neko kana');
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

  it('/neko epoch は現在のエポックタイムを秒単位で返す', async () => {
    const result = await interpretAichatSlashCommand('/neko epoch', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '1783213323' });
  });

  it('/neko ip はCloudflareから渡された接続元IPアドレスを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko ip', now, {
      ...unusedDeps,
      clientIp: '2001:db8::1',
    });
    expect(result).toEqual({ handled: true, response: '接続元IPアドレス: 2001:db8::1' });
  });

  it('/neko ip で接続元IPアドレスを取得できない場合はエラーを明示する', async () => {
    const result = await interpretAichatSlashCommand('/neko ip', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ 接続元IPアドレスを取得できませんでした' });
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
    expect((result as { response: string }).response).toContain('| /neko mlb |');
    expect((result as { response: string }).response).not.toContain('/neko mlb [AL\\|NL] [EAST\\|CENTRAL\\|WEST]');
  });

  it('未対応のサブコマンドはエラーメッセージを返す（握りつぶさない）', async () => {
    const result = await interpretAichatSlashCommand('/neko unknown', now, unusedDeps);
    expect(result.handled).toBe(true);
    expect((result as { response: string }).response).toContain('unknown');
    expect((result as { response: string }).response).toContain('/neko hms');
    expect((result as { response: string }).response).toContain('/neko ip');
    expect((result as { response: string }).response).toContain('/neko cal');
    expect((result as { response: string }).response).toContain('/neko clog');
  });

  it('サブコマンド無指定は/neko helpと同じヘルプを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: formatAichatSlashCommandHelp() });
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

  it('/neko kana <全角カナ> は半角カナへの変換結果を表示する（WASM等の外部依存なし）', async () => {
    const result = await interpretAichatSlashCommand('/neko kana カタカナ', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: formatKanaConvertResult('カタカナ', 'ｶﾀｶﾅ') });
  });

  it('/neko kana は空白を含む引数を1つの文字列として結合してから変換する', async () => {
    const result = await interpretAichatSlashCommand('/neko kana キャベツ トマト', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: formatKanaConvertResult('キャベツ トマト', 'ｷｬﾍﾞﾂ ﾄﾏﾄ') });
  });

  it('/neko kana で変換対象の文字列未指定の場合はエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko kana', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ 変換する文字列を指定してください: /neko kana <全角カナ>' });
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

describe('convertZenkakuKatakanaToHankaku', () => {
  it('清音の全角カタカナを半角カナに変換する', () => {
    expect(convertZenkakuKatakanaToHankaku('カタカナ')).toBe('ｶﾀｶﾅ');
  });

  it('濁点付きの全角カタカナは半角カナ+濁点(2文字)に変換する', () => {
    expect(convertZenkakuKatakanaToHankaku('ガギグゲゴ')).toBe('ｶﾞｷﾞｸﾞｹﾞｺﾞ');
    expect(convertZenkakuKatakanaToHankaku('ヴ')).toBe('ｳﾞ');
  });

  it('半濁点付きの全角カタカナは半角カナ+半濁点(2文字)に変換する', () => {
    expect(convertZenkakuKatakanaToHankaku('パピプペポ')).toBe('ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ');
  });

  it('拗音・促音・長音符も変換する', () => {
    expect(convertZenkakuKatakanaToHankaku('キャベツ')).toBe('ｷｬﾍﾞﾂ');
    expect(convertZenkakuKatakanaToHankaku('ッ')).toBe('ｯ');
    expect(convertZenkakuKatakanaToHankaku('コーヒー')).toBe('ｺｰﾋｰ');
  });

  it('全角の句読点・カギ括弧・中黒も半角に変換する', () => {
    expect(convertZenkakuKatakanaToHankaku('「ネコ」、猫。')).toBe('｢ﾈｺ｣､猫｡');
  });

  it('カタカナ以外の文字(ひらがな・漢字・英数字)はそのまま残す', () => {
    expect(convertZenkakuKatakanaToHankaku('ひらがなKanji123ｶﾀｶﾅ')).toBe('ひらがなKanji123ｶﾀｶﾅ');
  });

  it('半角カナに対応する文字が存在しないヶ・ヵはそのまま残す', () => {
    expect(convertZenkakuKatakanaToHankaku('1ヶ月・3ヵ国')).toBe('1ヶ月･3ヵ国');
  });

  it('空文字列を渡すと空文字列を返す', () => {
    expect(convertZenkakuKatakanaToHankaku('')).toBe('');
  });
});

describe('formatKanaConvertResult', () => {
  it('入力と変換結果をMarkdownで表示する', () => {
    const result = formatKanaConvertResult('カタカナ', 'ｶﾀｶﾅ');
    expect(result).toBe('## 半角カナ変換\n入力: カタカナ\n変換結果: ｶﾀｶﾅ');
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

describe('/neko ls', () => {
  const now = new Date('2026-08-26T10:00:00Z');
  const unusedDeps = { fetchLatestCommitAgentLog: vi.fn().mockRejectedValue(new Error('should not be called')) };

  it('/neko ls (オプション無し) はlong=false, all=falseでlsViaWasmを呼ぶ', async () => {
    const lsViaWasm = vi.fn().mockResolvedValue('dig_bg.wasm\nfactor_bg.wasm');
    const result = await interpretAichatSlashCommand('/neko ls', now, { ...unusedDeps, lsViaWasm });
    expect(lsViaWasm).toHaveBeenCalledWith(false, false);
    expect(result).toEqual({ handled: true, response: '## ls (WASM)\n```\ndig_bg.wasm\nfactor_bg.wasm\n```' });
  });

  it('/neko ls -l はlong=trueでlsViaWasmを呼ぶ', async () => {
    const lsViaWasm = vi.fn().mockResolvedValue('-rw-r--r-- 1 neko neko 100 2026-08-20 a.wasm');
    await interpretAichatSlashCommand('/neko ls -l', now, { ...unusedDeps, lsViaWasm });
    expect(lsViaWasm).toHaveBeenCalledWith(true, false);
  });

  it('/neko ls -a はall=trueでlsViaWasmを呼ぶ', async () => {
    const lsViaWasm = vi.fn().mockResolvedValue('mock');
    await interpretAichatSlashCommand('/neko ls -a', now, { ...unusedDeps, lsViaWasm });
    expect(lsViaWasm).toHaveBeenCalledWith(false, true);
  });

  it('/neko ls -la / -al はlong=true, all=trueの両方でlsViaWasmを呼ぶ', async () => {
    const lsViaWasm = vi.fn().mockResolvedValue('mock');
    await interpretAichatSlashCommand('/neko ls -la', now, { ...unusedDeps, lsViaWasm });
    expect(lsViaWasm).toHaveBeenLastCalledWith(true, true);
    await interpretAichatSlashCommand('/neko ls -al', now, { ...unusedDeps, lsViaWasm });
    expect(lsViaWasm).toHaveBeenLastCalledWith(true, true);
  });

  it('/neko ls は lsViaWasm 未設定時にエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko ls', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ /neko ls は現在利用できません(WASM未設定)' });
  });

  it('/neko ls で lsViaWasm が例外を投げた場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const lsViaWasm = vi.fn().mockRejectedValue(new Error('wasm init failed'));
    const result = await interpretAichatSlashCommand('/neko ls', now, { ...unusedDeps, lsViaWasm });
    expect(result).toEqual({ handled: true, response: '❌ /neko ls の実行中にエラーが発生しました: wasm init failed' });
  });
});

describe('formatLsWasmResult', () => {
  it('lsの結果をコードブロック付きMarkdownで表示する', () => {
    const result = formatLsWasmResult('a.wasm\nb.wasm');
    expect(result).toBe('## ls (WASM)\n```\na.wasm\nb.wasm\n```');
  });

  it('結果が空文字列の場合はコードブロックではなく「表示できる項目がありません」を表示する', () => {
    const result = formatLsWasmResult('');
    expect(result).toBe('## ls (WASM)\n(表示できる項目がありません)');
  });
});

describe('/neko tlist', () => {
  const now = new Date('2026-08-29T10:00:00Z');
  const unusedDeps = { fetchLatestCommitAgentLog: vi.fn().mockRejectedValue(new Error('should not be called')) };

  it('countdownListの結果をformatCountdownListResultで表示する', async () => {
    const events = [{ label: '会議', targetAt: '2026-09-01T10:00:00.000Z' }];
    const countdownList = vi.fn().mockResolvedValue(events);
    const result = await interpretAichatSlashCommand('/neko tlist', now, { ...unusedDeps, countdownList });
    expect(countdownList).toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: formatCountdownListResult(events) });
  });

  it('countdownList未設定時はエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko tlist', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ /neko tlist は現在利用できません(DB未設定)' });
  });

  it('countdownListが例外を投げた場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const countdownList = vi.fn().mockRejectedValue(new Error('db error'));
    const result = await interpretAichatSlashCommand('/neko tlist', now, { ...unusedDeps, countdownList });
    expect(result).toEqual({ handled: true, response: '❌ /neko tlist の実行中にエラーが発生しました: db error' });
  });
});

describe('formatCountdownListResult', () => {
  it('日時昇順のMarkdownテーブルで表示する', () => {
    const events = [
      { label: '会議', targetAt: '2026-09-01T10:05:00.000Z' },
      { label: '締め切り', targetAt: '2026-09-03T00:00:00.000Z' },
    ];
    const result = formatCountdownListResult(events);
    expect(result).toContain('| 日時 | 予定 |');
    const meetingLine = result.split('\n').find((l) => l.includes('会議'));
    const deadlineLine = result.split('\n').find((l) => l.includes('締め切り'));
    expect(meetingLine).toBeTruthy();
    expect(deadlineLine).toBeTruthy();
    expect(result.indexOf(meetingLine as string)).toBeLessThan(result.indexOf(deadlineLine as string));
  });

  it('0件の場合は登録案内を表示する', () => {
    const result = formatCountdownListResult([]);
    expect(result).toBe('## 次の予定一覧\n登録されている予定はありません(/countdownページから登録できます)');
  });
});

describe('getJstDateYmdHyphen', () => {
  it('UTC時刻をJST(UTC+9)のYYYY-MM-DD形式に変換する(日付が繰り上がる場合を含む)', () => {
    expect(getJstDateYmdHyphen(new Date('2026-07-05T01:02:03Z'))).toBe('2026-07-05');
    // UTC 23:00 は JST では翌日16:00になる(日付繰り上がりの故障シナリオ)
    expect(getJstDateYmdHyphen(new Date('2026-07-04T23:00:00Z'))).toBe('2026-07-05');
  });
});

describe('parseMlbFilterArgs', () => {
  it('引数なしは「すべて」を返す', () => {
    expect(parseMlbFilterArgs([])).toEqual({ filter: 'all', label: 'すべて' });
  });

  it('AL/NL単独(大文字小文字を区別しない)はリーグ全体を返す', () => {
    expect(parseMlbFilterArgs(['AL'])).toEqual({ filter: 'AL', label: 'AL' });
    expect(parseMlbFilterArgs(['nl'])).toEqual({ filter: 'NL', label: 'NL' });
  });

  it('league+地区名(大文字小文字を区別しない)は該当地区を返す', () => {
    expect(parseMlbFilterArgs(['AL', 'EAST'])).toEqual({ filter: 'AL-EAST', label: 'AL EAST' });
    expect(parseMlbFilterArgs(['nl', 'central'])).toEqual({ filter: 'NL-CENTRAL', label: 'NL CENTRAL' });
    expect(parseMlbFilterArgs(['al', 'west'])).toEqual({ filter: 'AL-WEST', label: 'AL WEST' });
  });

  it('不正な書式はnullを返す(呼び出し側で書式エラーを表示させる)', () => {
    expect(parseMlbFilterArgs(['NPB'])).toBeNull();
    expect(parseMlbFilterArgs(['AL', 'NORTH'])).toBeNull();
    expect(parseMlbFilterArgs(['EAST', 'AL'])).toBeNull();
  });
});

describe('mlbFilterTeamIds / filterMlbGamesByDivision', () => {
  const gameOf = (awayTeamId: number, homeTeamId: number): MlbTodayGame => ({
    gameDate: '2026-07-05T23:00:00Z',
    awayTeamId,
    homeTeamId,
    awayAbbr: 'AAA',
    homeAbbr: 'BBB',
    awayPitcher: null,
    homePitcher: null,
  });

  it("'all'はnull(絞り込みなし)を返す", () => {
    expect(mlbFilterTeamIds('all')).toBeNull();
  });

  it("'AL'/'NL'はそれぞれ3地区15球団分のteamIdを合算して返す(重複なし)", () => {
    const al = mlbFilterTeamIds('AL')!;
    const nl = mlbFilterTeamIds('NL')!;
    expect(al).toHaveLength(15);
    expect(nl).toHaveLength(15);
    expect(new Set(al).size).toBe(15);
    // AL/NLで球団IDが重複しない(全30球団が過不足なく分かれている)
    expect(al.some((id) => nl.includes(id))).toBe(false);
  });

  it('地区フィルター(例: AL-WEST)はaway/homeどちらかがその地区の試合のみに絞り込む', () => {
    const alWestIds = mlbFilterTeamIds('AL-WEST')!;
    expect(alWestIds).toContain(108); // LAA
    const games = [
      gameOf(108, 147), // AL-WEST(away) vs AL-EAST(home) → 含まれる
      gameOf(147, 121), // AL-EAST(away) vs NL-EAST(home)、AL-WESTを含まない → 含まれない
      gameOf(147, 108), // AL-EAST(away) vs AL-WEST(home) → 含まれる
    ];
    const filtered = filterMlbGamesByDivision(games, 'AL-WEST');
    expect(filtered).toHaveLength(2);
    expect(filtered).toContain(games[0]);
    expect(filtered).toContain(games[2]);
  });
});

describe('formatMlbTodayScheduleResult', () => {
  it('開始時刻昇順のMarkdownテーブルで、対戦カードの両脇に先発投手名を表示する', () => {
    const games: MlbTodayGame[] = [
      {
        gameDate: '2026-07-05T23:10:00Z',
        awayTeamId: 147,
        homeTeamId: 111,
        awayAbbr: 'NYY',
        homeAbbr: 'BOS',
        awayPitcher: 'Gerrit Cole',
        homePitcher: 'Tanner Houck',
      },
      {
        gameDate: '2026-07-05T17:05:00Z',
        awayTeamId: 121,
        homeTeamId: 143,
        awayAbbr: 'NYM',
        homeAbbr: 'PHI',
        awayPitcher: null,
        homePitcher: 'Zack Wheeler',
      },
    ];
    const result = formatMlbTodayScheduleResult(games, 'すべて');
    expect(result).toContain('## MLB 本日の試合予定(すべて)');
    expect(result).toContain('| 開始時刻 | 対戦カード | アウェイ先発 | ホーム先発 |');
    const lines = result.split('\n');
    const nymLine = lines.find((l) => l.includes('NYM @ PHI'));
    const nyyLine = lines.find((l) => l.includes('NYY @ BOS'));
    expect(nymLine).toBeTruthy();
    expect(nyyLine).toBeTruthy();
    // 開始時刻の早い(17:05Z)NYM戦が、遅い(23:10Z)NYY戦より先に表示される
    expect(lines.indexOf(nymLine as string)).toBeLessThan(lines.indexOf(nyyLine as string));
    expect(nymLine).toContain('未定');
    expect(nyyLine).toContain('Gerrit Cole');
    expect(nyyLine).toContain('Tanner Houck');
  });

  it('試合が0件の場合はその旨を表示する', () => {
    const result = formatMlbTodayScheduleResult([], 'AL WEST');
    expect(result).toBe('## MLB 本日の試合予定(AL WEST)\n該当する試合はありません');
  });
});

describe('/neko mlb', () => {
  const now = new Date('2026-07-05T10:00:00Z');
  const unusedDeps = { fetchLatestCommitAgentLog: vi.fn().mockRejectedValue(new Error('should not be called')) };
  const sampleGame: MlbTodayGame = {
    gameDate: '2026-07-05T23:10:00Z',
    awayTeamId: 147,
    homeTeamId: 111,
    awayAbbr: 'NYY',
    homeAbbr: 'BOS',
    awayPitcher: 'Gerrit Cole',
    homePitcher: 'Tanner Houck',
  };

  it('引数なしはfetchMlbTodayScheduleの全試合をそのまま表示する', async () => {
    const fetchMlbTodaySchedule = vi.fn().mockResolvedValue([sampleGame]);
    const result = await interpretAichatSlashCommand('/neko mlb', now, { ...unusedDeps, fetchMlbTodaySchedule });
    expect(fetchMlbTodaySchedule).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ handled: true, response: formatMlbTodayScheduleResult([sampleGame], 'すべて') });
  });

  it('/neko mlb AL EAST は該当地区の試合のみに絞り込んで表示する', async () => {
    const otherLeagueGame: MlbTodayGame = { ...sampleGame, awayTeamId: 119, homeTeamId: 137 }; // NL West同士
    const fetchMlbTodaySchedule = vi.fn().mockResolvedValue([sampleGame, otherLeagueGame]);
    const result = await interpretAichatSlashCommand('/neko mlb AL EAST', now, { ...unusedDeps, fetchMlbTodaySchedule });
    expect(result).toEqual({
      handled: true,
      response: formatMlbTodayScheduleResult(filterMlbGamesByDivision([sampleGame, otherLeagueGame], 'AL-EAST'), 'AL EAST'),
    });
    expect((result as { response: string }).response).toContain('NYY @ BOS');
    expect((result as { response: string }).response).not.toContain('該当する試合はありません');
  });

  it('不正な書式はエラーメッセージを返す(fetchMlbTodayScheduleを呼ばない)', async () => {
    const fetchMlbTodaySchedule = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko mlb NPB', now, { ...unusedDeps, fetchMlbTodaySchedule });
    expect(fetchMlbTodaySchedule).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: '❌ 書式が正しくありません: /neko mlb [AL|NL] [EAST|CENTRAL|WEST]' });
  });

  it('fetchMlbTodaySchedule未設定時はエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko mlb', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ /neko mlb は現在利用できません(MLBスケジュールAPI未設定)' });
  });

  it('fetchMlbTodayScheduleが例外を投げた場合はエラーメッセージを返す(握りつぶさない)', async () => {
    const fetchMlbTodaySchedule = vi.fn().mockRejectedValue(new Error('upstream error'));
    const result = await interpretAichatSlashCommand('/neko mlb', now, { ...unusedDeps, fetchMlbTodaySchedule });
    expect(result).toEqual({ handled: true, response: '❌ /neko mlb でエラーが発生しました: upstream error' });
  });
});
