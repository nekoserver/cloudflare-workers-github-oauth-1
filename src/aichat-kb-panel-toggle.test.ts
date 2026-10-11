import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: /aichat ページの送信欄下にある「応答をリアルタイム表示」チェックボックス
// (aichatStreamToggle)の左に新設する「未分類パネル」チェックボックス(kbPanelToggle、
// src/views/aichat.ts)。入力欄の上にある「探索の境界線」パネル(未分類キーワード、
// keywordBoundaryPanel)の表示/非表示を切り替え、非表示にした際は実行中の
// 自動探索も同時に停止する(ユーザー指示: 「同時に自動探索もOFFになるよう制御」)。
//
// 故障シナリオ:
//   (1) kbPanelToggleがaichatStreamToggleの左(=markup上で手前)に描画されない
//   (2) チェックを外してもkeywordBoundaryPanelの表示が変わらない
//   (3) チェックを外したときに自動探索が実行中でも停止されない(パネルだけ
//       隠れてバックグラウンドで動き続ける)
//   (4) 実行中でない時にチェックを外すと、存在しない処理を呼んで例外になる

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('未分類パネルの表示切り替えチェックボックス(kbPanelToggle)', () => {
  it('aichatStreamToggleの左(markup上で手前)に描画される', () => {
    const html = buildPage();
    const kbIdx = html.indexOf('id="kbPanelToggle"');
    const streamIdx = html.indexOf('id="aichatStreamToggle"');
    expect(kbIdx).toBeGreaterThan(-1);
    expect(streamIdx).toBeGreaterThan(-1);
    expect(kbIdx).toBeLessThan(streamIdx);
  });

  it('デフォルトはチェック済みで、localStorage(aichat_kb_panel_enabled)を読み書きする(aichatStreamToggleと同じ方式)', () => {
    const html = buildPage();
    expect(html).toContain('<input type="checkbox" id="kbPanelToggle" checked>');
    expect(html).toContain("kbPanelToggle.checked = localStorage.getItem('aichat_kb_panel_enabled') !== 'off';");
    expect(html).toContain("localStorage.setItem('aichat_kb_panel_enabled', kbPanelToggle.checked ? 'on' : 'off');");
  });

  it('チェックを外すとkeywordBoundaryPanelにkb-panel-hiddenクラスを付け、入れ直すと外す', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKbPanelToggle()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 500);
    expect(snippet).toContain("keywordBoundaryPanel.classList.remove('kb-panel-hidden');");
    expect(snippet).toContain("keywordBoundaryPanel.classList.add('kb-panel-hidden');");
  });

  it('.kb-panel-hiddenはdisplay:noneで、.kb-panel-visibleより優先される(!important)', () => {
    const html = buildPage();
    expect(html).toMatch(/\.kb-panel-hidden\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  });

  it('チェックを外した時はrequestAutoExploreCancel()を呼ぶ(実行中なら停止要求、停止中でなければ何もしない)', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKbPanelToggle()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain("keywordBoundaryPanel.classList.add('kb-panel-hidden');");
    expect(snippet).toContain('requestAutoExploreCancel();');
  });

  it('requestAutoExploreCancel()は実行中なら停止要求を立ててボタンを「停止中...」にし、実行中でなければ何もしない', () => {
    const html = buildPage();
    const idx = html.indexOf('function requestAutoExploreCancel()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('if (!autoExploreRunning) return;');
    expect(snippet).toContain('autoExploreCancelRequested = true;');
    expect(snippet).toContain("autoExploreBtn.textContent = '⏹ 停止中...';");
  });

  it('autoExploreBtnのクリックハンドラも共通のrequestAutoExploreCancel()を使う(重複実装しない)', () => {
    const html = buildPage();
    const idx = html.indexOf("autoExploreBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('requestAutoExploreCancel();');
  });
});
