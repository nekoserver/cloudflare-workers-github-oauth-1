import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

describe('ai_chat_shares トークン表示: HTML 構造', () => {
  it('historyModalTokens 要素が存在する', () => {
    expect(buildPage()).toContain('id="historyModalTokens"');
  });

  it('historyModalTokens が historyModalMeta の後にある', () => {
    const html = buildPage();
    const metaIdx = html.indexOf('id="historyModalMeta"');
    const tokenIdx = html.indexOf('id="historyModalTokens"');
    expect(metaIdx).toBeGreaterThan(-1);
    expect(tokenIdx).toBeGreaterThan(metaIdx);
  });

  it('historyModalTokens が historyModalShareLink より前にある', () => {
    const html = buildPage();
    const tokenIdx = html.indexOf('id="historyModalTokens"');
    const shareIdx = html.indexOf('id="historyModalShareLink"');
    expect(tokenIdx).toBeGreaterThan(-1);
    expect(shareIdx).toBeGreaterThan(tokenIdx);
  });
});

describe('ai_chat_shares トークン表示: JS 変数・関数', () => {
  it('historyModalTokens 変数が JS に存在する', () => {
    expect(buildPage()).toContain("var historyModalTokens = document.getElementById('historyModalTokens')");
  });

  it('renderHistoryModalTokens 関数が存在する', () => {
    expect(buildPage()).toContain('function renderHistoryModalTokens(r)');
  });

  it('renderHistoryModalTokens が input_tokens を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderHistoryModalTokens(r)');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('r.input_tokens');
  });

  it('renderHistoryModalTokens が output_tokens を参照する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderHistoryModalTokens(r)');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain('r.output_tokens');
  });

  it('renderHistoryModalTokens がトークンなし時に空文字をセットする', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderHistoryModalTokens(r)');
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain("historyModalTokens.textContent = parts.length > 0");
  });
});

describe('ai_chat_shares トークン表示: 呼び出し箇所', () => {
  it('showHistoryModal 内で renderHistoryModalTokens が呼ばれる', () => {
    const html = buildPage();
    const idx = html.indexOf('function showHistoryModal(r, keyword)');
    const snippet = html.slice(idx, idx + 1700);
    expect(snippet).toContain('renderHistoryModalTokens(r)');
  });

  it('applyData 内で renderHistoryModalTokens が呼ばれる（スワイプナビゲーション対応）', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyData(data)');
    const snippet = html.slice(idx, idx + 600);
    expect(snippet).toContain('renderHistoryModalTokens(data)');
  });
});

describe('ai_chat_shares トークン表示: JS 構文チェック', () => {
  it('script タグ内の JS に構文エラーがない', () => {
    const html = buildPage();
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = scriptRe.exec(html)) !== null) {
      const js = m[1];
      expect(() => {
        new Function(`(function(){\n${js}\n})`);
      }).not.toThrow();
    }
  });
});
