// @vitest-environment jsdom
// 対象: AIチャットページ(/aichat)の入力欄にフォーカスしソフトウェアキーボードが
// 表示されたあと、画面が入力欄を基準にうわずったまま元に戻らずハングアップする
// 現象(ユーザー指摘)。
//
// 故障シナリオ:
//   (1) html,body は height:100%; overflow:hidden の固定レイアウトで、
//       documentは本来スクロールしない設計だが、モバイルブラウザが
//       フォーカス時にdocumentを独自にスクロール/パンし、overflow:hidden下では
//       通常の操作で戻せず画面がうわずったままになる
//   (2) 対策コード(pinDocumentScrollForKeyboard)がスクロール位置のずれを
//       検知しても(0,0)に戻さない、または呼ばれるべきイベントに
//       登録されていない
import { describe, expect, it, vi } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { extractFunctionSource } from './utils/extractFunctionSource';

const user = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: {},
};

function buildPage(): string {
  return getAiChatPage(user);
}

function loadPinDocumentScrollForKeyboard() {
  const html = buildPage();
  const source = extractFunctionSource(html, 'pinDocumentScrollForKeyboard');
  expect(source).toBeTruthy();
  return new Function(`${source}\nreturn pinDocumentScrollForKeyboard;`)() as () => void;
}

describe('AIチャット: 入力欄フォーカス時のキーボード表示によるハング対策', () => {
  it('viewport metaにinteractive-widget=resizes-contentが付き、Android等でレイアウトビューポートが実際に縮むようにする', () => {
    const html = buildPage();
    const idx = html.indexOf('name="viewport"');
    expect(idx).toBeGreaterThan(-1);
    const tag = html.slice(idx, idx + 150);
    expect(tag).toContain('interactive-widget=resizes-content');
  });

  it('pinDocumentScrollForKeyboardはスクロール位置が(0,0)からずれていればwindow.scrollTo(0,0)を呼ぶ', () => {
    const pin = loadPinDocumentScrollForKeyboard();
    const scrollToSpy = vi.fn();
    (window as any).scrollTo = scrollToSpy;
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 240, configurable: true });

    pin();

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it('pinDocumentScrollForKeyboardはスクロール位置が既に(0,0)なら何もしない(不要な呼び出しをしない)', () => {
    const pin = loadPinDocumentScrollForKeyboard();
    const scrollToSpy = vi.fn();
    (window as any).scrollTo = scrollToSpy;
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });

    pin();

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it('window の scroll イベントに pinDocumentScrollForKeyboard が登録されている', () => {
    const html = buildPage();
    const idx = html.indexOf('pinDocumentScrollForKeyboard');
    expect(idx).toBeGreaterThan(-1);
    const after = html.slice(idx, idx + 1200);
    expect(after).toContain("window.addEventListener('scroll', pinDocumentScrollForKeyboard");
  });

  it('visualViewportが存在する場合はresizeイベントにも登録される', () => {
    const html = buildPage();
    const idx = html.indexOf('pinDocumentScrollForKeyboard');
    const after = html.slice(idx, idx + 1200);
    expect(after).toContain('window.visualViewport');
    expect(after).toContain("addEventListener('resize', pinDocumentScrollForKeyboard)");
  });

  it('chatInputのblur後にもpinDocumentScrollForKeyboardが呼ばれる(キーボードを閉じた直後の戻し漏れ対策)', () => {
    const html = buildPage();
    const idx = html.indexOf('pinDocumentScrollForKeyboard');
    const after = html.slice(idx, idx + 1200);
    expect(after).toContain("chatInput.addEventListener('blur'");
    const blurIdx = after.indexOf("chatInput.addEventListener('blur'");
    const blurBlock = after.slice(blurIdx, blurIdx + 200);
    expect(blurBlock).toContain('pinDocumentScrollForKeyboard');
  });
});
