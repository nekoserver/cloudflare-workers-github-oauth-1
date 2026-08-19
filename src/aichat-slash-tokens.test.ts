import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  formatHourlyTokenUsage,
  interpretAichatSlashCommand,
  AICHAT_SEARCH_TIMEOUT_MS,
  type HourlyTokenUsageRow,
} from './utils/aichatSlashCommand';

// 対象: AIチャットの入力窓 `/neko tokens` サブコマンド。
// 過去24時間のモデル別トークン使用量を1時間刻みでMarkdownテーブル表示する。
// モーダル(モデル別トークン使用量)は月毎/日毎の粒度切替に対応済みだが、
// より細かい「直近24時間を1時間刻みで確認したい」というニーズには、
// チャット入力窓からすぐ結果が見られるスラッシュコマンドで応える。
//
// 故障シナリオ:
//   (1) depsが未提供・DB未設定の場合に例外になる
//   (2) 0件の場合に空文字やundefinedを返して握りつぶす
//   (3) 罫線・ツリー文字(CLAUDE.mdルール16)を使ってしまい表示が崩れる
//   (4) DB問い合わせが長時間応答しない場合に永久に待ち続けてしまう(ハング)
//   (5) DB問い合わせが例外を投げた場合に、エラーメッセージを返さず
//       握りつぶしてしまう(CLAUDE.mdルール8: 記録・通知の義務)
//   (6) 複数モデル・複数時間帯の集計で合計値の計算を誤る
//   (7) 末尾のモデル別総和テーブルで、同じモデルが複数の時間帯にまたがる場合に
//       合算し忘れて重複行や過小な合計値になる

describe('formatHourlyTokenUsage', () => {
  it('時間帯・モデルごとにMarkdownテーブルの行を組み立て、末尾に合計を表示する', () => {
    const rows: HourlyTokenUsageRow[] = [
      { hour: '2026-07-15 09:00', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', input_tokens: 100, output_tokens: 200, request_count: 2 },
      { hour: '2026-07-15 10:00', model: '@cf/google/gemma-3-12b-it', input_tokens: 50, output_tokens: 80, request_count: 1 },
    ];
    const text = formatHourlyTokenUsage(rows);
    expect(text).toContain('| 2026-07-15 09:00 | llama-3.3-70b-instruct-fp8-fast | 100 | 200 | 2 |');
    expect(text).toContain('| 2026-07-15 10:00 | gemma-3-12b-it | 50 | 80 | 1 |');
    expect(text).toContain('計: 入力 150 / 出力 280 / 3件');
  });

  it('末尾に、使用したモデルをループ元として使用量を合算したモデル別総和テーブルを付け加える', () => {
    const rows: HourlyTokenUsageRow[] = [
      { hour: '2026-07-15 09:00', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', input_tokens: 100, output_tokens: 200, request_count: 2 },
      { hour: '2026-07-15 10:00', model: '@cf/google/gemma-3-12b-it', input_tokens: 50, output_tokens: 80, request_count: 1 },
      { hour: '2026-07-15 11:00', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', input_tokens: 30, output_tokens: 40, request_count: 1 },
    ];
    const text = formatHourlyTokenUsage(rows);
    const summaryIdx = text.indexOf('### モデル別総和');
    expect(summaryIdx).toBeGreaterThan(-1);
    const summary = text.slice(summaryIdx);
    // llama-3.3は09:00分(100/200/2件)と11:00分(30/40/1件)を合算して130/240/3件になる
    expect(summary).toContain('| llama-3.3-70b-instruct-fp8-fast | 130 | 240 | 3 |');
    expect(summary).toContain('| gemma-3-12b-it | 50 | 80 | 1 |');
  });

  it('モデル別総和テーブルは、時間帯ごとの明細テーブルより後ろに出力される', () => {
    const rows: HourlyTokenUsageRow[] = [
      { hour: '2026-07-15 09:00', model: 'model-a', input_tokens: 10, output_tokens: 10, request_count: 1 },
    ];
    const text = formatHourlyTokenUsage(rows);
    const detailIdx = text.indexOf('| 2026-07-15 09:00 |');
    const summaryIdx = text.indexOf('### モデル別総和');
    expect(detailIdx).toBeGreaterThan(-1);
    expect(summaryIdx).toBeGreaterThan(detailIdx);
  });

  it('0件の場合は記録が無い旨を表示する(空文字やundefinedにしない)', () => {
    const text = formatHourlyTokenUsage([]);
    expect(text).toContain('記録はありません');
    expect(text.length).toBeGreaterThan(0);
  });

  it('罫線・ツリー文字を使わない(CLAUDE.mdルール16)', () => {
    const rows: HourlyTokenUsageRow[] = [
      { hour: '2026-07-15 09:00', model: 'test-model', input_tokens: 1, output_tokens: 1, request_count: 1 },
    ];
    expect(formatHourlyTokenUsage(rows)).not.toMatch(/[├└│─┼]/);
  });
});

describe('interpretAichatSlashCommand: /neko tokens', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  it('/neko tokens はdepsのhourlyTokenUsageを呼び、整形結果を返す', async () => {
    const rows: HourlyTokenUsageRow[] = [
      { hour: '2026-07-15 09:00', model: 'test-model', input_tokens: 10, output_tokens: 20, request_count: 1 },
    ];
    const fn = vi.fn().mockResolvedValue(rows);
    const result = await interpretAichatSlashCommand('/neko tokens', now, {
      fetchLatestCommitAgentLog: async () => null,
      hourlyTokenUsage: fn,
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ handled: true, response: formatHourlyTokenUsage(rows) });
  });

  it('depsにhourlyTokenUsageが無い場合は記録なしと表示する(例外にならない)', async () => {
    const result = await interpretAichatSlashCommand('/neko tokens', now, {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result).toEqual({ handled: true, response: formatHourlyTokenUsage([]) });
  });

  it('未対応コマンドのヘルプ・/neko helpに /neko tokens を含める', async () => {
    const deps = { fetchLatestCommitAgentLog: async () => null };
    const unknown = await interpretAichatSlashCommand('/neko unknown', now, deps);
    expect(unknown.handled).toBe(true);
    if (!unknown.handled) throw new Error('not handled');
    expect(unknown.response).toContain('/neko tokens');

    const help = await interpretAichatSlashCommand('/neko help', now, deps);
    expect(help.handled).toBe(true);
    if (!help.handled) throw new Error('not handled');
    expect(help.response).toContain('/neko tokens');
    expect(help.response).toContain('24時間');
  });
});

describe('interpretAichatSlashCommand: /neko tokens のタイムアウト・エラー処理', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  afterEach(() => {
    vi.useRealTimers();
  });

  it(`hourlyTokenUsageが${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答しない場合はタイムアウトの案内を返す(ハングしない)`, async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<HourlyTokenUsageRow[]>(() => {});
    const fn = vi.fn().mockReturnValue(neverResolves);

    const resultPromise = interpretAichatSlashCommand('/neko tokens', now, {
      fetchLatestCommitAgentLog: async () => null,
      hourlyTokenUsage: fn,
    });
    await vi.advanceTimersByTimeAsync(AICHAT_SEARCH_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
    expect(result.response).toContain('/neko tokens');
  });

  it('タイムアウト時間より前に応答すれば、通常どおり整形結果を返す', async () => {
    vi.useFakeTimers();
    const rows: HourlyTokenUsageRow[] = [];
    const fn = vi.fn().mockResolvedValue(rows);

    const resultPromise = interpretAichatSlashCommand('/neko tokens', now, {
      fetchLatestCommitAgentLog: async () => null,
      hourlyTokenUsage: fn,
    });
    await vi.advanceTimersByTimeAsync(10);
    const result = await resultPromise;

    expect(result).toEqual({ handled: true, response: formatHourlyTokenUsage(rows) });
  });

  it('hourlyTokenUsageが例外を投げた場合は握りつぶさずエラーメッセージを返す', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('D1 query failed'));
    const result = await interpretAichatSlashCommand('/neko tokens', now, {
      fetchLatestCommitAgentLog: async () => null,
      hourlyTokenUsage: fn,
    });

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('エラー');
    expect(result.response).toContain('D1 query failed');
  });
});
