import { describe, expect, it, vi } from 'vitest';
import {
  buildYmdCandidates,
  formatAichatSlashCommandHelp,
  formatPrimeYmdSearchResult,
  interpretAichatSlashCommand,
} from './utils/aichatSlashCommand';

// 対象: `/neko fymd`・`/neko factor -a <日数>`。素数日判定は、以前はJS側の
// 独自試し割り実装(isPrimeInteger)で行っていたが、factor-wasm(Rust実装)の
// is_prime()へ一本化した(2つの素数判定実装が食い違うリスクを避けるため)。
// buildYmdCandidates()は日付候補の列挙だけを担う純粋関数で、素数判定自体は
// 呼び出し側がisPrimeViaWasm(WASM経由)で行う。

const unusedDeps = { fetchLatestCommitAgentLog: async () => null };

describe('buildYmdCandidates', () => {
  it('今日(0日目)から指定日数後まで、古い順にYYYYMMDDを列挙する', () => {
    const result = buildYmdCandidates(new Date('2026-01-30T15:00:00.000Z'), 3);
    // JST(UTC+9)で1/31開始、2/1をまたぐ
    expect(result).toEqual(['20260131', '20260201', '20260202', '20260203']);
  });

  it('days=0なら今日1件だけを返す', () => {
    expect(buildYmdCandidates(new Date('2026-08-28T15:00:00.000Z'), 0)).toEqual(['20260829']);
  });
});

describe('formatPrimeYmdSearchResult', () => {
  it('見つかった素数日を日付昇順のMarkdownテーブルで表示する', () => {
    const result = formatPrimeYmdSearchResult(10, ['20260829', '20260909']);
    expect(result).toContain('## 素数日検索(今日から10日以内)');
    expect(result).toContain('| YYYYMMDD |');
    expect(result).toContain('| 20260829 |');
    expect(result).toContain('| 20260909 |');
  });

  it('0件の場合はその旨を返す', () => {
    const result = formatPrimeYmdSearchResult(3, []);
    expect(result).toBe('## 素数日検索(今日から3日以内)\n該当する素数日はありませんでした');
  });
});

describe('/neko fymd', () => {
  const now = new Date('2026-08-28T15:00:00.000Z'); // JST 2026-08-29

  it('isPrimeViaWasmで最初に素数と判定された日を返す(候補を古い順に1つずつ判定する)', async () => {
    const isPrimeViaWasm = vi.fn().mockImplementation(async (n: number) => n === 20260901);
    const result = await interpretAichatSlashCommand('/neko fymd', now, { ...unusedDeps, isPrimeViaWasm });
    expect(result).toEqual({ handled: true, response: '20260901' });
    // 20260829, 20260830, ... と古い順に判定していき、20260901で最初にtrueになる
    expect(isPrimeViaWasm.mock.calls[0][0]).toBe(20260829);
    expect(isPrimeViaWasm.mock.calls[isPrimeViaWasm.mock.calls.length - 1][0]).toBe(20260901);
  });

  it('今日自体が素数ならisPrimeViaWasmを1回呼ぶだけで今日を返す', async () => {
    const isPrimeViaWasm = vi.fn().mockResolvedValue(true);
    const result = await interpretAichatSlashCommand('/neko fymd', now, { ...unusedDeps, isPrimeViaWasm });
    expect(result).toEqual({ handled: true, response: '20260829' });
    expect(isPrimeViaWasm).toHaveBeenCalledTimes(1);
  });

  it('引数があっても無視する', async () => {
    const isPrimeViaWasm = vi.fn().mockResolvedValue(true);
    const result = await interpretAichatSlashCommand('/neko fymd ignored arguments', now, { ...unusedDeps, isPrimeViaWasm });
    expect(result).toEqual({ handled: true, response: '20260829' });
  });

  it('isPrimeViaWasm未設定時はエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko fymd', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ /neko fymd は現在利用できません(WASM未設定)' });
  });

  it('isPrimeViaWasmが例外を投げた場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const isPrimeViaWasm = vi.fn().mockRejectedValue(new Error('wasm error'));
    const result = await interpretAichatSlashCommand('/neko fymd', now, { ...unusedDeps, isPrimeViaWasm });
    expect(result).toEqual({ handled: true, response: '❌ /neko fymd の実行中にエラーが発生しました: wasm error' });
  });

  it('ヘルプに掲載されている', () => {
    expect(formatAichatSlashCommandHelp()).toContain('| /neko fymd |');
  });
});

describe('/neko factor -a <日数>', () => {
  const now = new Date('2026-08-28T15:00:00.000Z'); // JST 2026-08-29

  it('今日から指定日数後までの候補すべてを判定し、素数日だけを一覧表示する', async () => {
    const isPrimeViaWasm = vi.fn().mockImplementation(async (n: number) => n === 20260829 || n === 20260901);
    const result = await interpretAichatSlashCommand('/neko factor -a 5', now, { ...unusedDeps, isPrimeViaWasm });
    expect(isPrimeViaWasm).toHaveBeenCalledTimes(6); // 0〜5日目の6件全てを判定する
    expect(result).toEqual({ handled: true, response: formatPrimeYmdSearchResult(5, ['20260829', '20260901']) });
  });

  it('0件でもエラーにせず「該当なし」を返す', async () => {
    const isPrimeViaWasm = vi.fn().mockResolvedValue(false);
    const result = await interpretAichatSlashCommand('/neko factor -a 3', now, { ...unusedDeps, isPrimeViaWasm });
    expect(result).toEqual({ handled: true, response: formatPrimeYmdSearchResult(3, []) });
  });

  it('日数が未指定・非整数・0以下・上限超過の場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const isPrimeViaWasm = vi.fn().mockRejectedValue(new Error('should not be called'));
    for (const bad of ['', '0', '-1', '1.5', 'abc', '3651']) {
      const result = await interpretAichatSlashCommand(`/neko factor -a ${bad}`, now, { ...unusedDeps, isPrimeViaWasm });
      expect((result as { response: string }).response).toContain('❌');
    }
    expect(isPrimeViaWasm).not.toHaveBeenCalled();
  });

  it('isPrimeViaWasm未設定時はエラーメッセージを返す', async () => {
    const result = await interpretAichatSlashCommand('/neko factor -a 10', now, unusedDeps);
    expect(result).toEqual({ handled: true, response: '❌ /neko factor -a は現在利用できません(WASM未設定)' });
  });

  it('isPrimeViaWasmが例外を投げた場合はエラーメッセージを返す（握りつぶさない）', async () => {
    const isPrimeViaWasm = vi.fn().mockRejectedValue(new Error('wasm error'));
    const result = await interpretAichatSlashCommand('/neko factor -a 10', now, { ...unusedDeps, isPrimeViaWasm });
    expect(result).toEqual({ handled: true, response: '❌ /neko factor -a の実行中にエラーが発生しました: wasm error' });
  });

  it('-aが無い通常の/neko factor <数値>は従来どおりfactorViaWasmを使う(回帰確認)', async () => {
    const factorViaWasm = vi.fn().mockResolvedValue('12: 2 2 3');
    const isPrimeViaWasm = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko factor 12', now, { ...unusedDeps, factorViaWasm, isPrimeViaWasm });
    expect(factorViaWasm).toHaveBeenCalledWith(12);
    expect(isPrimeViaWasm).not.toHaveBeenCalled();
    expect(result).toEqual({ handled: true, response: '## factor (WASM)\n```\n12: 2 2 3\n```' });
  });
});
