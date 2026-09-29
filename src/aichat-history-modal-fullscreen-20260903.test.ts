import { describe, it, expect } from 'vitest';
import { getAiChatPage } from './views/aichat';

const minimalUser = {
  username: 'testuser',
  aiChatModel: 'claude-sonnet-4-6',
};

// 対象: AIチャットの詳細プレビューモーダル(historyModal)の閉じるボタン(✕)の左に
// 追加した「⬜︎」全画面表示切り替えボタン。タップするとモーダルを画面いっぱいに
// 広げ、もう一度タップすると元のサイズに戻る。
//
// 故障シナリオ:
//   (1) ボタンをHTMLに置いただけでクリックハンドラが配線されておらず反応しない
//   (2) 全画面化した状態でモーダルを閉じ、再度開いたときに全画面のままになる
//       (fullscreenクラスがcloseHistoryModal相当の箇所でリセットされていない)

describe('historyModalの全画面表示切り替えボタン', () => {
  it('閉じるボタンの直前に⬜︎ボタンが配置されている', () => {
    const html = getAiChatPage(minimalUser);
    const closeIdx = html.indexOf('id="historyModalClose"');
    const fullscreenIdx = html.indexOf('id="historyModalFullscreenBtn"');
    expect(fullscreenIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(-1);
    expect(fullscreenIdx).toBeLessThan(closeIdx);
    expect(html.slice(fullscreenIdx, fullscreenIdx + 200)).toContain('⬜︎');
  });

  it('クリックでフレームなし全画面表示を切り替える', () => {
    const html = getAiChatPage(minimalUser);
    const start = html.indexOf("historyModalFullscreenBtn.addEventListener('click'");
    expect(start).toBeGreaterThan(-1);
    const body = html.slice(start, start + 600);
    expect(body).toContain("historyModal.classList.toggle('frames-hidden')");
    expect(body).toContain("historyModal.classList.toggle('fullscreen', isFrameless)");
    expect(body).toContain("historyModalBackdrop.classList.toggle('fullscreen', isFrameless)");
  });

  it('モーダルを閉じる箇所(closeHistoryModal・再質問確認後の遷移)でfullscreenクラスをリセットする', () => {
    const html = getAiChatPage(minimalUser);
    const closeFnStart = html.indexOf('function closeHistoryModal()');
    expect(closeFnStart).toBeGreaterThan(-1);
    const closeFnBody = html.slice(closeFnStart, closeFnStart + 400);
    expect(closeFnBody).toContain("historyModal.classList.remove('fullscreen')");

    const reAskStart = html.indexOf('openReAskResponseModal(selectedModel, question)');
    expect(reAskStart).toBeGreaterThan(-1);
    const reAskBefore = html.slice(reAskStart - 200, reAskStart);
    expect(reAskBefore).toContain("historyModal.classList.remove('fullscreen')");
  });
});
