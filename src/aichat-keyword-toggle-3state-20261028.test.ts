import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

// ページに埋め込まれた実コードから関数を取り出して実行する(写しを別に書いて通すだけのテストにしない)。
function loadPageFunction<T>(name: string, extraArgs = ''): T {
  const html = getAiChatPage(minimalUser);
  const start = html.indexOf(`function ${name}(`);
  expect(start, `${name} がページに無い`).toBeGreaterThan(-1);
  let depth = 0;
  let end = -1;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const src = html.slice(start, end);
  return new Function(`${extraArgs}${src}; return ${name};`)() as T;
}

describe('🔑トグル: 3段階の切り替え順', () => {
  it('ハイライトON → ハイライトOFF/パネルOFF → パネルON/ハイライトOFF → ハイライトON の順に進む', () => {
    const next = loadPageFunction<(m: string) => string>('nextKeywordToggleMode');
    expect(next('highlight')).toBe('off');
    expect(next('off')).toBe('panel');
    expect(next('panel')).toBe('highlight');
  });

  it('想定外の値が来ても、最初の状態(ハイライトON)に戻る', () => {
    const next = loadPageFunction<(m: unknown) => string>('nextKeywordToggleMode');
    expect(next(undefined)).toBe('highlight');
    expect(next('foo')).toBe('highlight');
  });
});

describe('🔑トグル: 各段階のハイライト/パネルの組み合わせ', () => {
  it('highlight はハイライトON・パネルOFF', () => {
    const view = loadPageFunction<(m: string) => { highlightActive: boolean; panelOn: boolean }>('keywordToggleView');
    expect(view('highlight')).toEqual({ highlightActive: true, panelOn: false });
  });

  it('off はハイライトOFF・パネルOFF', () => {
    const view = loadPageFunction<(m: string) => { highlightActive: boolean; panelOn: boolean }>('keywordToggleView');
    expect(view('off')).toEqual({ highlightActive: false, panelOn: false });
  });

  it('panel はハイライトOFF・パネルON', () => {
    const view = loadPageFunction<(m: string) => { highlightActive: boolean; panelOn: boolean }>('keywordToggleView');
    expect(view('panel')).toEqual({ highlightActive: false, panelOn: true });
  });

  it('現在の状態(ハイライト/パネルのフラグ)から段階を逆算できる', () => {
    const mode = loadPageFunction<(h: boolean, p: boolean) => string>('currentKeywordToggleMode');
    expect(mode(true, false)).toBe('highlight');
    expect(mode(false, false)).toBe('off');
    expect(mode(false, true)).toBe('panel');
  });
});

describe('🔑トグル: ページ側の配線', () => {
  const html = getAiChatPage(minimalUser);

  it('クリック処理が、段階の計算を nextKeywordToggleMode に任せている', () => {
    const idx = html.indexOf("historyModalHighlightToggleBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const handler = html.slice(idx, idx + 2200);
    expect(handler).toContain('nextKeywordToggleMode(');
  });

  it('ハイライトOFFにしただけではキーワードパネルを自動で出さない(パネルは panel の段階だけ)', () => {
    const idx = html.indexOf('function updateHighlightToggleBtn');
    const fn = html.slice(idx, idx + 1400);
    expect(fn).not.toContain('renderKeywordChips(!highlightsVisible');
    expect(fn).toContain('historyModalKwPanelOn');
  });

  it('別の履歴を開き直したときはパネルの状態を初期化する', () => {
    const idx = html.indexOf('historyModalChipsPinned = false;');
    expect(idx).toBeGreaterThan(-1);
    expect(html.slice(idx, idx + 200)).toContain('historyModalKwPanelOn = false');
  });
});
