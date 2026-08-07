import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { generateSlackAiReply } from './utils/slackAiReply';
import { vi } from 'vitest';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};
function buildPage(): string { return getAiChatPage(minimalUser); }

// 対象: AIチャットページ左サイドパネルの検索窓からSlackの@メンション質問ログを
// 開くとページがフリーズするバグ。原因は、SlackのデフォルトモデルであるSLACK_AI_MODEL
// (gemma-4-26b-a4b-it)がAICHAT_MODEL_MAX_TOKENSで65536という大きな上限を持ち、
// その応答全文がai_chat_sharesに保存される点にある。検索結果からその履歴を開くと
// クライアント側のMarkdownパーサー・キーワードハイライト処理が巨大な文字列に対して
// 走り、ページが応答不能になる。

describe('generateSlackAiReply: Slack応答のmax_tokensが巨大にならないこと', () => {
  it('gemma-4-26b-a4b-itのAICHAT_MODEL_MAX_TOKENS(65536)をそのまま使わない', async () => {
    const aiRun = vi.fn().mockResolvedValue({ response: 'ok' });
    await generateSlackAiReply('hello', '@cf/google/gemma-4-26b-a4b-it', aiRun);
    const [, params] = aiRun.mock.calls[0];
    expect((params as { max_tokens: number }).max_tokens).toBeLessThan(65536);
  });
});

describe('AIチャットページ: 履歴プレビューの巨大テキスト対策(truncateForHistoryPreview)', () => {
  it('truncateForHistoryPreview 関数が存在する', () => {
    const html = buildPage();
    expect(html).toContain('function truncateForHistoryPreview');
  });

  it('appendHistoryModalBubble内でtruncateForHistoryPreviewを通してからparseMdへ渡す', () => {
    const html = buildPage();
    const idx = html.indexOf('function appendHistoryModalBubble');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('parseMd(truncateForHistoryPreview(text))');
  });

  it('showResultsPanel(検索結果パネル)内でtruncateForHistoryPreviewを通してからparseMdへ渡す', () => {
    const html = buildPage();
    const idx = html.indexOf('function showResultsPanel');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('parseMd(truncateForHistoryPreview(r.answer))');
  });

  it('historyModalSwipeNavigate(履歴モーダルのスワイプ切替)内でもtruncateForHistoryPreviewを通す', () => {
    const html = buildPage();
    const idx = html.indexOf('function historyModalSwipeNavigate');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 1000);
    expect(fn).toContain('parseMd(truncateForHistoryPreview(data.answer))');
  });

  it('上限文字数を超える入力は切り詰めて末尾に省略メッセージを付与する(ロジックの直接検証)', () => {
    const html = buildPage();
    const idx = html.indexOf('function truncateForHistoryPreview');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('.slice(0, HISTORY_PREVIEW_MAX_CHARS)');
    expect(fn).toContain('省略');
  });

  it('上限文字数以下の入力はそのまま返す(早期return)', () => {
    const html = buildPage();
    const idx = html.indexOf('function truncateForHistoryPreview');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 300);
    expect(fn).toContain('return text;');
  });
});
