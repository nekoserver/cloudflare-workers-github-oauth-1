import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: /aichat ページの✂️ボタン(回答バブル内・詳細プレビューモーダル内の
// 両方)。押しても背景色が一瞬変わるだけで「何が起きたか」が利用者に
// 伝わらず、動作していても無反応に見えていた不具合の修正。
//   (1) クリックしてから処理が終わるまで、ボタンにスピナー用CSSクラス
//       (scissors-btn-spinning)を付与し続ける
//   (2) ベクタ化+キーワード抽出(vectorizeAnswerAndExtractKeywords)が
//       成功したら水色トーストで「✂️切り出し完了」を表示する
//   (3) 未登録キーワードの一括登録(bulkRegisterUnregisteredKeywords)が
//       成功したら「新規キーワード切り出し完了」トーストを表示する
//   (4) 一連の処理がすべて終わったら緑色トーストで「ベクタ化終了」を表示する
//      (キーワードが1件も無かった場合も、抽出完了後すぐに表示する)
//
// 故障シナリオ:
//   (1) スピナークラスが処理開始時に付かない、または終了後も残り続ける
//   (2) トーストの文言・配色クラスが呼び出し元(回答バブル/詳細モーダル)で
//       食い違う
//   (3) キーワードが0件の場合にベクタ化終了トーストが出ない
//   (4) showAichatToastが#aichatSendToastContainerを使わず、既存の
//       送信結果トーストと表示位置がずれる

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('showAichatToast: ✂️の進行状況を伝える汎用トースト関数', () => {
  it('#aichatSendToastContainerへ追加する(既存の送信結果トーストと同じコンテナを共有)', () => {
    const html = buildPage();
    const idx = html.indexOf('function showAichatToast(');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 700);
    expect(snippet).toContain("document.getElementById('aichatSendToastContainer')");
  });

  it('4秒後にフェードし、フェード完了後にDOMから取り除く(既存の送信結果トーストと同じ挙動)', () => {
    const html = buildPage();
    const idx = html.indexOf('function showAichatToast(');
    const snippet = html.slice(idx, idx + 700);
    expect(snippet).toContain('4000');
    expect(snippet).toContain("toast.classList.add('aichat-send-toast-fade')");
  });
});

describe('回答バブルの✂️ボタン: スピナー・進行トースト', () => {
  it('クリック時にスピナー用CSSクラスを付与し、処理完了後(成功・失敗いずれも)に取り除く', () => {
    const html = buildPage();
    const idx = html.indexOf('function runVectorizeAndBulkRegisterChain()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 1700);
    expect(snippet).toContain("scissorsBtn.classList.add('scissors-btn-spinning')");
    expect(snippet).toContain("scissorsBtn.classList.remove('scissors-btn-spinning')");
    // removeは.catch()の後のthen(常に実行される後処理)に置き、
    // 成功・失敗どちらでもスピナーが回り続けたままにならないようにする
    const removeIdx = snippet.indexOf("scissorsBtn.classList.remove('scissors-btn-spinning')");
    const catchIdx = snippet.indexOf('.catch(function() {})');
    expect(catchIdx).toBeGreaterThan(-1);
    expect(removeIdx).toBeGreaterThan(catchIdx);
  });

  it('ベクタ化+キーワード抽出成功時に水色トーストで「✂️切り出し完了」を表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function runVectorizeAndBulkRegisterChain()');
    const snippet = html.slice(idx, idx + 1400);
    expect(snippet).toContain("showAichatToast('✂️切り出し完了', 'aichat-scissors-toast-cyan')");
  });

  it('未登録キーワードの一括登録成功時に「新規キーワード切り出し完了」トーストを表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function runVectorizeAndBulkRegisterChain()');
    const snippet = html.slice(idx, idx + 1400);
    expect(snippet).toContain("showAichatToast('新規キーワード切り出し完了', 'aichat-scissors-toast-neutral')");
  });

  it('キーワードが1件も無い場合でも、抽出完了直後に緑色トーストで「ベクタ化終了」を表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function runVectorizeAndBulkRegisterChain()');
    const snippet = html.slice(idx, idx + 1400);
    const noKeywordsIdx = snippet.indexOf('if (!keywords.length) {');
    expect(noKeywordsIdx).toBeGreaterThan(-1);
    const noKeywordsBranch = snippet.slice(noKeywordsIdx, noKeywordsIdx + 120);
    expect(noKeywordsBranch).toContain("showAichatToast('ベクタ化終了', 'aichat-send-toast-ok')");
  });

  it('一括登録まで完了した場合も、最終的に緑色トーストで「ベクタ化終了」を表示する', () => {
    const html = buildPage();
    const idx = html.indexOf('function runVectorizeAndBulkRegisterChain()');
    const snippet = html.slice(idx, idx + 1400);
    const bulkIdx = snippet.indexOf('bulkRegisterUnregisteredKeywords(shareId, keywords, {})');
    expect(bulkIdx).toBeGreaterThan(-1);
    const afterBulk = snippet.slice(bulkIdx, bulkIdx + 300);
    expect(afterBulk).toContain("showAichatToast('ベクタ化終了', 'aichat-send-toast-ok')");
  });
});

describe('詳細プレビューモーダルの✂️ボタン: スピナー・進行トースト(回答バブルと同じ挙動を共有)', () => {
  it('クリック時にスピナー用CSSクラスを付与し、処理完了後に取り除く', () => {
    const html = buildPage();
    const idx = html.indexOf("historyModalScissorsBtn.addEventListener('click'");
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 1900);
    expect(snippet).toContain("historyModalScissorsBtn.classList.add('scissors-btn-spinning')");
    expect(snippet).toContain("historyModalScissorsBtn.classList.remove('scissors-btn-spinning')");
  });

  it('ベクタ化+キーワード抽出成功時に水色トースト、一括登録成功時にトースト、最終的に緑色トーストを表示する', () => {
    const html = buildPage();
    const idx = html.indexOf("historyModalScissorsBtn.addEventListener('click'");
    const snippet = html.slice(idx, idx + 1600);
    expect(snippet).toContain("showAichatToast('✂️切り出し完了', 'aichat-scissors-toast-cyan')");
    expect(snippet).toContain("showAichatToast('新規キーワード切り出し完了', 'aichat-scissors-toast-neutral')");
    expect(snippet).toContain("showAichatToast('ベクタ化終了', 'aichat-send-toast-ok')");
  });
});

describe('スピナーCSSアニメーション', () => {
  it('scissors-btn-spinningクラスに回転アニメーションが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.scissors-btn-spinning { display: inline-block; animation: scissorsBtnSpin 0.8s linear infinite; }');
    expect(html).toContain('@keyframes scissorsBtnSpin');
  });
});

describe('script タグ内の JS に構文エラーがない(トースト・スピナー追加後)', () => {
  it('パースエラーを起こさない', () => {
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
