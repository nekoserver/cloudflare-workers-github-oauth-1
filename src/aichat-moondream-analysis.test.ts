// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットページ(/aichat)で画像を添付して送信したとき、
// /api/moondream-analyze の分析結果を応答バブル内に表示する機能。
//
// 故障シナリオ:
//   (1) 画像添付時に /api/moondream-analyze へリクエストが送られない
//   (2) /api/aichat と /api/moondream-analyze のどちらが先に完了しても
//       取りこぼす(バブル生成前に分析結果が届く/分析結果より先にバブルが
//       生成される、の両方のタイミングに対応できていない)
//   (3) 画像を添付していないのに /api/moondream-analyze を呼んでしまう
//   (4) 分析結果表示用のCSSクラスがtemplate literal内で固定色になっている
//       (CLAUDE.CSS.mdルール: 固定色禁止・CSS変数を使う)
//   (5) 機能追加によりscriptタグに構文エラーが混入する

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

describe('/aichat ページ: 画像添付時のMoondream分析結果表示', () => {
  const html = buildPage();
  const submitIdx = html.indexOf("chatForm.addEventListener('submit'");
  const block = html.slice(submitIdx, submitIdx + 2600);

  it('画像添付時のみ /api/moondream-analyze へPOSTする(if (attachedImage) でガードされている)', () => {
    expect(block).toMatch(/if \(attachedImage\) \{\s*fetch\('\/api\/moondream-analyze'/);
  });

  it('moondream-analyzeへは画像(data URL)とプロンプト(currentMsg)を渡す', () => {
    expect(block).toContain('image: attachedImage');
    expect(block).toContain('prompt: currentMsg');
  });

  it('assistantバブル生成と分析結果到着のどちらが先でもtryAppendMoondream()で取りこぼさない', () => {
    expect(block).toContain('function tryAppendMoondream()');
    expect(block).toContain('if (assistantBubbleEl && moondreamAnalysisText)');
    // /api/aichat 成功時にassistantBubbleElを設定してから呼ぶ
    expect(block).toMatch(/assistantBubbleEl = appendBubble\([^)]*\);\s*\n\s*tryAppendMoondream\(\);/);
    // /api/moondream-analyze 成功時にmoondreamAnalysisTextを設定してから呼ぶ
    expect(block).toMatch(/moondreamAnalysisText = data\.analysis;\s*\n\s*tryAppendMoondream\(\);/);
  });

  it('appendMoondreamAnalysis関数が分析結果パネルをバブル要素に追記する', () => {
    expect(html).toContain('function appendMoondreamAnalysis(bubbleEl, analysisText)');
    expect(html).toContain("panel.className = 'moondream-analysis'");
    expect(html).toContain('bubbleEl.appendChild(panel)');
  });

  it('分析結果パネルのCSSは固定色でなくCSS変数(var(--...))を使う', () => {
    const cssM = html.match(/\.moondream-analysis \{[\s\S]*?\.moondream-analysis-body \{[^}]*\}/);
    expect(cssM).not.toBeNull();
    const css = cssM![0];
    expect(css).toContain('var(--card-bg)');
    expect(css).toContain('var(--border-color)');
    expect(css).toContain('var(--accent-color)');
    expect(css).toContain('var(--text-secondary)');
    // 16進固定色(#で始まる3桁/6桁カラーコード)が含まれていないこと
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });

  it('script タグに構文エラーがない(Moondream連携追加後)', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});
