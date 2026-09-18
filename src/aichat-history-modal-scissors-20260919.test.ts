import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: /aichat ページの詳細プレビューモーダル(historyModal, src/views/aichat.ts)。
// Jev評価値(📔)ボタンの右に✂️ボタンを新設し、クリックされたら
// (1) GET /api/aichat/shares/:id で既登録(vectorized)チェックを行い
// (2) vectorizeAnswerAndExtractKeywords でPlaMo埋め込みモデルによる
//     ベクタ化+予備知識キーワード抽出を行い
// (3) 抽出できたキーワードがあれば bulkRegisterUnregisteredKeywords で
//     一括登録する。
//
// 故障シナリオ:
//   (1) ✂️ボタンがHTML/JSどちらにも生成されない
//   (2) ボタンが📔ボタンより先(左)に配置されてしまう
//   (3) クリックしても既登録チェックを行わずいきなりベクタ化する
//   (4) ベクタ化に失敗した場合でもbulkRegisterUnregisteredKeywordsが呼ばれる
//   (5) モーダルを開き直しても✂️の黄色/通常表示が更新されない
//       (📔ボタンのrefreshに相乗りできていない)

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('詳細プレビューモーダル: Jev評価値ボタン右の✂️ボタン', () => {
  it('historyModalScissorsBtn がHTMLに存在し、historyModalJevValuesBtn より後(右)にある', () => {
    const html = buildPage();
    const jevIdx = html.indexOf('id="historyModalJevValuesBtn"');
    const scissorsIdx = html.indexOf('id="historyModalScissorsBtn"');
    expect(jevIdx).toBeGreaterThan(-1);
    expect(scissorsIdx).toBeGreaterThan(jevIdx);
  });

  it('historyModalScissorsBtn 変数がJSで取得される', () => {
    const html = buildPage();
    expect(html).toContain("var historyModalScissorsBtn = document.getElementById('historyModalScissorsBtn')");
  });

  it('クリック時、まず GET /api/aichat/shares/:id で既登録チェックを行ってから vectorizeAnswerAndExtractKeywords を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("historyModalScissorsBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 1200);
    const checkIdx = snippet.indexOf("fetch('/api/aichat/shares/' + encodeURIComponent(String(shareId))");
    const vectorizeIdx = snippet.indexOf('vectorizeAnswerAndExtractKeywords(shareId, model)');
    expect(checkIdx).toBeGreaterThan(-1);
    expect(vectorizeIdx).toBeGreaterThan(checkIdx);
  });

  it('ベクタ化成功時、抽出キーワードがあれば bulkRegisterUnregisteredKeywords を呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf("historyModalScissorsBtn.addEventListener('click'");
    const snippet = html.slice(idx, idx + 1400);
    expect(snippet).toContain('bulkRegisterUnregisteredKeywords(shareId, keywords, {})');
  });

  it('shareIdが無い(historyModalCurrentIdが未設定)場合は何もしない', () => {
    const html = buildPage();
    const idx = html.indexOf("historyModalScissorsBtn.addEventListener('click'");
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('if (!shareId) return;');
  });

  it('refreshJevValuesButtonStateがrefreshHistoryModalScissorsStateも呼び、モーダル再表示時に✂️の状態を更新する', () => {
    const html = buildPage();
    const idx = html.indexOf('function refreshJevValuesButtonState()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 200);
    expect(snippet).toContain('historyModalJevValuesWidget.refresh();');
    expect(snippet).toContain('refreshHistoryModalScissorsState();');
  });

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
