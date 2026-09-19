import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: /aichat ページ(src/views/aichat.ts の buildAssistantBubble)。
// 回答バブルのトークン表示の左に✂️アイコンを置き、埋め込みテーブル
// (aichat_answer_vectors)に未登録の場合は背景を黄色にする。隣の
// チェックボックスがONの状態でJev判定(runJevScoreAndShow)が完了したら、
// vectorizeAnswerAndExtractKeywords→bulkRegisterUnregisteredKeywordsを
// 自動で実行する。
//
// 故障シナリオ:
//   (1) ✂️ボタンがそもそも生成されない
//   (2) 未ベクタ化時に黄色背景にならない
//   (3) チェックボックスの状態がCookieに保存されない
//   (4) Jev判定完了時にチェックボックスOFFでも自動実行されてしまう
//   (5) vectorizeAndBulkRegister.tsの関数が埋め込まれておらず
//       ReferenceErrorになる

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('AIチャット回答バブル: ✂️ベクタ化+自動一括登録', () => {
  it('scissorsBtn(✂️)がbuildAssistantBubble内に生成される', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildAssistantBubble(');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 6000);
    expect(snippet).toContain("scissorsBtn.textContent = '✂️'");
  });

  it('未ベクタ化(vectorized=false)時に黄色背景を適用するロジックがある', () => {
    const html = buildPage();
    expect(html).toContain("scissorsBtn.style.background = isAnswerVectorizedForScissors ? '' : '#fff8c5'");
  });

  it('GET /api/aichat/shares/:id を呼んでvectorized状態を確認する', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildAssistantBubble(');
    const snippet = html.slice(idx, idx + 6000);
    expect(snippet).toContain("fetch('/api/aichat/shares/' + encodeURIComponent(String(shareId))");
  });

  it('自動化チェックボックスがCookie(aichat_auto_vectorize_after_jev)を読み書きする', () => {
    const html = buildPage();
    expect(html).toContain('aichat_auto_vectorize_after_jev');
    expect(html).toContain('AUTO_VECTORIZE_COOKIE + \'=\' + (autoVectorizeCheckbox.checked ? \'on\' : \'off\')');
  });

  it('createJevValuesWidgetにonJevCompleteコールバックを渡す', () => {
    const html = buildPage();
    const idx = html.indexOf('function buildAssistantBubble(');
    const snippet = html.slice(idx, idx + 10000);
    expect(snippet).toContain('onJevComplete: function()');
  });

  it('onJevComplete内は✂️チェックボックスとjev自動化チェックボックスが両方ONかつ未ベクタ化の場合のみ自動実行する', () => {
    const html = buildPage();
    const idx = html.indexOf('onJevComplete: function()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 300);
    expect(snippet).toContain('if (autoJevCheckbox.checked && autoVectorizeCheckbox.checked && !isAnswerVectorizedForScissors)');
    expect(snippet).toContain('runVectorizeAndBulkRegisterChain();');
  });

  it('jev評価の自動化チェックボックス(aichat_auto_jev_score)がCookieを読み書きする', () => {
    const html = buildPage();
    expect(html).toContain('aichat_auto_jev_score');
    expect(html).toContain('AUTO_JEV_COOKIE + \'=\' + (autoJevCheckbox.checked ? \'on\' : \'off\')');
  });

  it('onStateLoaded内はjev自動化チェックボックスONかつ未評価(pink/yellow)の場合のみrunJevScoreAndShowを自動実行する', () => {
    const html = buildPage();
    const idx = html.indexOf('onStateLoaded: function(state)');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 400);
    expect(snippet).toContain("if (autoJevCheckbox.checked && (state === 'pink' || state === 'yellow'))");
    expect(snippet).toContain('bubbleJevWidget.runJevScoreAndShow();');
  });

  it('onStateLoaded内はJev評価が既に完了済み(green)の場合も両方ONかつ未ベクタ化なら✂️チェーンを自動実行する(不具合修正)', () => {
    const html = buildPage();
    const idx = html.indexOf('onStateLoaded: function(state)');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 1300);
    expect(snippet).toContain("if (autoJevCheckbox.checked && autoVectorizeCheckbox.checked && state === 'green' && !isAnswerVectorizedForScissors)");
    expect(snippet).toContain('runVectorizeAndBulkRegisterChain();');
  });

  it('createJevValuesWidgetがonStateLoadedをrefresh成功時・失敗時の両方で呼び出す', () => {
    const html = buildPage();
    const idx = html.indexOf('function refresh()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 900);
    const occurrences = snippet.split("if (typeof onStateLoaded === 'function') onStateLoaded(").length - 1;
    expect(occurrences).toBe(2);
  });

  it('createJevValuesWidget自体がonJevCompleteをJev成功時に呼び出す', () => {
    const html = buildPage();
    const idx = html.indexOf('function runJevScoreAndShow()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 2000);
    expect(snippet).toContain("if (typeof onJevComplete === 'function') onJevComplete(shareIdAtRequest, modelAtRequest);");
  });

  it('共有スクリプト(vectorizeAnswerAndExtractKeywords/bulkRegisterUnregisteredKeywords)が埋め込まれている', () => {
    const html = buildPage();
    expect(html).toContain('function vectorizeAnswerAndExtractKeywords(shareId, model, forcePlamo)');
    expect(html).toContain('function bulkRegisterUnregisteredKeywords(originShareId, keywords, callbacks)');
  });

  it('runVectorizeAndBulkRegisterChainがvectorizeAnswerAndExtractKeywordsを呼び、成功後にbulkRegisterUnregisteredKeywordsを呼ぶ', () => {
    const html = buildPage();
    const idx = html.indexOf('function runVectorizeAndBulkRegisterChain()');
    expect(idx).toBeGreaterThan(-1);
    const snippet = html.slice(idx, idx + 900);
    expect(snippet).toContain('vectorizeAnswerAndExtractKeywords(shareId, AICHAT_SCISSORS_EMBEDDING_MODEL, true)');
    expect(snippet).toContain('bulkRegisterUnregisteredKeywords(shareId, keywords, {})');
  });

  it('埋め込みモデルはチャットモデル(buildAssistantBubbleのmodel引数)ではなく固定のPlaMoモデルを使う(空欄/不明モデルによる400エラー防止)', () => {
    const html = buildPage();
    expect(html).toContain("var AICHAT_SCISSORS_EMBEDDING_MODEL = '@cf/pfnet/plamo-embedding-1b';");
    const idx = html.indexOf('function runVectorizeAndBulkRegisterChain()');
    const snippet = html.slice(idx, idx + 900);
    expect(snippet).not.toContain('vectorizeAnswerAndExtractKeywords(shareId, model)');
  });

  it('forcePlamo=trueを渡し、サーバー側でも旧デプロイのチャットモデル名混入に対して強制的にPlaMoへ上書きしてもらう(二重の安全策)', () => {
    const html = buildPage();
    const idx = html.indexOf('function runVectorizeAndBulkRegisterChain()');
    const snippet = html.slice(idx, idx + 900);
    expect(snippet).toContain('vectorizeAnswerAndExtractKeywords(shareId, AICHAT_SCISSORS_EMBEDDING_MODEL, true)');
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
