import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  extractYoutubeLinksFromSearchItems,
  formatVlinkResult,
  interpretAichatSlashCommand,
  AICHAT_SEARCH_TIMEOUT_MS,
} from './utils/aichatSlashCommand';

// 対象: AIチャットの入力窓 `/neko vlink <キーワード>` サブコマンド。
// Googleに「YouTube <キーワード>」で検索をかけ、検索結果のうち
// https://www.youtube.com から始まるリンクだけを抽出して表示する。
//
// 故障シナリオ:
//   (1) キーワード未指定の場合に例外になる、またはAI呼び出しへ委ねられてしまう
//   (2) 検索APIが返す結果にyoutube.com以外のリンク(まとめサイト等)が
//       混ざったまま表示してしまう(要件はyoutube.comのみの抽出)
//   (3) linkフィールドが欠けている検索結果が混ざった場合に例外で落ちる
//   (4) http:// や m.youtube.com、youtu.be等、www.youtube.comで始まらない
//       ドメインを誤って含めてしまう(要件はhttps://www.youtube.comのみ)
//   (5) 検索結果が0件、またはyoutube.comのリンクが1件もない場合に
//       空文字やundefinedを返して握りつぶす
//   (6) 検索API未設定(GOOGLE_CSE_API_KEY/CX未設定)の場合にAI呼び出しへ
//       委ねてしまう、または例外で落ちる
//   (7) 検索APIが長時間応答しない場合に無期限にハングする

describe('extractYoutubeLinksFromSearchItems', () => {
  it('https://www.youtube.com から始まるリンクのみを抽出する', () => {
    const items = [
      { link: 'https://www.youtube.com/watch?v=abc123' },
      { link: 'https://example.com/matome' },
      { link: 'https://www.youtube.com/watch?v=xyz789' },
    ];
    expect(extractYoutubeLinksFromSearchItems(items)).toEqual([
      'https://www.youtube.com/watch?v=abc123',
      'https://www.youtube.com/watch?v=xyz789',
    ]);
  });

  it('youtu.be・m.youtube.com・httpのyoutube.comは対象外(www.youtube.com https限定)', () => {
    const items = [
      { link: 'https://youtu.be/abc123' },
      { link: 'https://m.youtube.com/watch?v=abc123' },
      { link: 'http://www.youtube.com/watch?v=abc123' },
    ];
    expect(extractYoutubeLinksFromSearchItems(items)).toEqual([]);
  });

  it('linkフィールドが欠けている項目は例外にせずスキップする', () => {
    const items = [{ link: 'https://www.youtube.com/watch?v=abc123' }, {}, { link: undefined }];
    expect(extractYoutubeLinksFromSearchItems(items)).toEqual(['https://www.youtube.com/watch?v=abc123']);
  });

  it('該当する検索結果が無ければ空配列を返す', () => {
    expect(extractYoutubeLinksFromSearchItems([{ link: 'https://example.com/' }])).toEqual([]);
    expect(extractYoutubeLinksFromSearchItems([])).toEqual([]);
  });
});

describe('formatVlinkResult', () => {
  it('抽出したリンクを箇条書きで表示する', () => {
    const text = formatVlinkResult('猫', ['https://www.youtube.com/watch?v=a', 'https://www.youtube.com/watch?v=b']);
    expect(text).toContain('猫');
    expect(text).toContain('https://www.youtube.com/watch?v=a');
    expect(text).toContain('https://www.youtube.com/watch?v=b');
  });

  it('0件の場合もその旨を明示する(握りつぶさない)', () => {
    const text = formatVlinkResult('見つからないキーワード', []);
    expect(text).toContain('見つからないキーワード');
    expect(text).toContain('見つかりませんでした');
  });

  it('罫線・ツリー文字を使わない(CLAUDE.mdルール16)', () => {
    expect(formatVlinkResult('猫', ['https://www.youtube.com/watch?v=a'])).not.toMatch(/[├└│─┼]/);
  });
});

describe('interpretAichatSlashCommand: /neko vlink', () => {
  const now = new Date('2026-09-12T00:00:00.000Z');

  it('/neko vlink <キーワード> はdepsのsearchYoutubeLinksへキーワードを渡し、リンク一覧を整形して返す', async () => {
    const links = ['https://www.youtube.com/watch?v=abc123'];
    const searchFn = vi.fn().mockResolvedValue(links);
    const result = await interpretAichatSlashCommand('/neko vlink 猫', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchYoutubeLinks: searchFn,
    });
    expect(searchFn).toHaveBeenCalledWith('猫');
    expect(result).toEqual({ handled: true, response: formatVlinkResult('猫', links) });
  });

  it('キーワードに空白を含む場合は"vlink"以降をすべて連結してキーワードとして渡す', async () => {
    const searchFn = vi.fn().mockResolvedValue([]);
    await interpretAichatSlashCommand('/neko vlink 猫 動画', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchYoutubeLinks: searchFn,
    });
    expect(searchFn).toHaveBeenCalledWith('猫 動画');
  });

  it('キーワード未指定の場合はdepsを呼ばずに使い方を案内する', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('should not be called'));
    const result = await interpretAichatSlashCommand('/neko vlink', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchYoutubeLinks: searchFn,
    });
    expect(searchFn).not.toHaveBeenCalled();
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('/neko vlink');
  });

  it('検索API未設定(depsにsearchYoutubeLinksが無い)場合はAI呼び出しへ委ねず案内する', async () => {
    const result = await interpretAichatSlashCommand('/neko vlink 猫', now, {
      fetchLatestCommitAgentLog: async () => null,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('❌');
    expect(result.response).toContain('/neko vlink');
  });

  it('searchYoutubeLinksが例外を投げた場合は握りつぶさずエラーメッセージを返す', async () => {
    const searchFn = vi.fn().mockRejectedValue(new Error('Google Custom Search API failed'));
    const result = await interpretAichatSlashCommand('/neko vlink 猫', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchYoutubeLinks: searchFn,
    });
    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('エラー');
    expect(result.response).toContain('Google Custom Search API failed');
  });

  it(`searchYoutubeLinksが${AICHAT_SEARCH_TIMEOUT_MS / 1000}秒以内に応答しない場合はタイムアウトの案内を返す(ハングしない)`, async () => {
    vi.useFakeTimers();
    const neverResolves = new Promise<string[]>(() => {});
    const searchFn = vi.fn().mockReturnValue(neverResolves);

    const resultPromise = interpretAichatSlashCommand('/neko vlink 猫', now, {
      fetchLatestCommitAgentLog: async () => null,
      searchYoutubeLinks: searchFn,
    });
    await vi.advanceTimersByTimeAsync(AICHAT_SEARCH_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result.handled).toBe(true);
    if (!result.handled) throw new Error('not handled');
    expect(result.response).toContain('タイムアウト');
    expect(result.response).toContain('/neko vlink');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('未対応コマンドのヘルプ・/neko helpに /neko vlink を含める', async () => {
    const deps = { fetchLatestCommitAgentLog: async () => null };
    const unknown = await interpretAichatSlashCommand('/neko unknown', now, deps);
    expect(unknown.handled).toBe(true);
    if (!unknown.handled) throw new Error('not handled');
    expect(unknown.response).toContain('/neko vlink');

    const help = await interpretAichatSlashCommand('/neko help', now, deps);
    expect(help.handled).toBe(true);
    if (!help.handled) throw new Error('not handled');
    expect(help.response).toContain('/neko vlink');
  });
});
