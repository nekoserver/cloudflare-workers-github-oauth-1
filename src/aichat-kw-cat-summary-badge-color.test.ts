import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットの「🔑 キーワード分類」モーダル(kwClassifyListBody)内、
// 最上段に並ぶ中分類カテゴリの概要バッジ(.kw-cat-summary-badge)。
//
// 故障シナリオ:
//   (1) バッジのHTML生成時にdata-cat-colorへ「分類:」モーダルで設定した
//       cat.colorを埋め込んではいるが、実際の見た目(border/color/背景)には
//       一切反映されず、常に固定のグレー(var(--bg-secondary)/var(--text-muted))
//       のまま表示される
//   (2) カテゴリを選択(フィルタ)した際の強調表示(.kw-cat-badge-active)が、
//       CSSの既定値(#3b82f6等の固定青)のままで、そのカテゴリ自身の色を
//       オーバーライドに使わない

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('キーワード分類モーダル: 中分類カテゴリバッジへの色反映', () => {
  it('applyKwBadgeColorsが.kw-cat-summary-badgeのdata-cat-colorを読んでスタイルに反映する', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('function renderKwClassifyList');
    expect(endIdx).toBeGreaterThan(idx);
    const fn = html.slice(idx, endIdx);

    // kw-cat-summary-badge を走査するブロックが data-cat-color(dataset.catColor)を
    // 参照していること
    const catBadgeBlockIdx = fn.indexOf('kw-cat-summary-badge');
    expect(catBadgeBlockIdx).toBeGreaterThan(-1);
    const catBadgeBlock = fn.slice(catBadgeBlockIdx);
    expect(catBadgeBlock).toContain('catColor');
    // 「分類:」モーダルで設定した色を、CSS変数(--kw-pal-cat/--kw-pal-cat-bg)経由で
    // .kw-cat-badge-active の既定色をオーバーライドできるようにしていること
    expect(catBadgeBlock).toContain('--kw-pal-cat');
  });

  it('.kw-cat-badge-active は --kw-pal-cat / --kw-pal-cat-bg 変数を使い、要素ごとの上書きを許容する', () => {
    const html = buildPage();
    const idx = html.indexOf('.kw-cat-badge-active');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('--kw-pal-cat');
    expect(snippet).toContain('--kw-pal-cat-bg');
  });
});
