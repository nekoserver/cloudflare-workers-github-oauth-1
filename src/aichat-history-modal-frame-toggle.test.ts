import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

const html = getAiChatPage({
  username: 'testuser',
  aiChatModel: 'claude-sonnet-4-6',
});

describe('詳細プレビューモーダル: フレーム表示切り替え', () => {
  it('frames-hiddenでは上下のフレームを除去し、切り替えボタンだけを残す', () => {
    expect(html).toContain('.history-modal.fullscreen.frames-hidden > .history-modal-foot');
    expect(html).toContain('.history-modal.fullscreen.frames-hidden > .history-modal-head > :not(.history-modal-fullscreen-btn)');
  });

  it('⬜︎ボタンでフレームなしの全画面表示へ切り替え、ボタンを🔲にする', () => {
    const clickStart = html.indexOf("historyModalFullscreenBtn.addEventListener('click'");
    const clickHandler = html.slice(clickStart, clickStart + 600);

    expect(clickStart).toBeGreaterThan(-1);
    expect(clickHandler).toContain("historyModal.classList.toggle('frames-hidden')");
    expect(clickHandler).toContain("historyModal.classList.toggle('fullscreen', isFrameless)");
    expect(clickHandler).toContain("historyModalBackdrop.classList.toggle('fullscreen', isFrameless)");
    expect(clickHandler).toContain("isFrameless ? '🔲' : '⬜︎'");
  });

  it('タッチ操作はフレーム表示を変更しない', () => {
    expect(html).not.toContain('historyPinchStartDistance');
    expect(html).not.toContain('historyPinchGestureActive');
    expect(html).not.toContain("historyModalChat.addEventListener('touchmove'");
  });

  it('モーダル終了時に表示状態とボタンをリセットする', () => {
    const closeStart = html.indexOf('function closeHistoryModal()');
    const closeFunction = html.slice(closeStart, closeStart + 600);

    expect(closeFunction).toContain("historyModal.classList.remove('fullscreen')");
    expect(closeFunction).toContain("historyModal.classList.remove('frames-hidden')");
    expect(closeFunction).toContain("historyModalFullscreenBtn.textContent = '⬜︎'");
  });
});
