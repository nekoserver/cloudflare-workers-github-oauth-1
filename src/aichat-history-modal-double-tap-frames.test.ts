import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

const html = getAiChatPage({
  username: 'testuser',
  aiChatModel: 'claude-sonnet-4-6',
});

describe('詳細プレビューモーダル: 最大化中のダブルタップ表示', () => {
  it('最大化中にframes-hiddenを付けると上下のフレームだけを非表示にする', () => {
    expect(html).toContain('.history-modal.fullscreen.frames-hidden > .history-modal-head');
    expect(html).toContain('.history-modal.fullscreen.frames-hidden > .history-modal-foot');
  });

  it('最大化中にチャット本文をダブルタップしたときだけフレームを隠す', () => {
    const doubleTapStart = html.indexOf("historyModalChat.addEventListener('dblclick'");
    const handler = html.slice(doubleTapStart, doubleTapStart + 400);

    expect(doubleTapStart).toBeGreaterThan(-1);
    expect(handler).toContain("if (!historyModal.classList.contains('fullscreen')) return");
    expect(handler).toContain("historyModal.classList.add('frames-hidden')");
    expect(handler).toContain('e.preventDefault()');
    expect(handler).toContain('e.stopPropagation()');
    expect(html).not.toContain('historyPinchGestureActive');
    expect(html).not.toContain('historyTouchDistance');
  });

  it('フレーム非表示中の再タップで表示を戻し、そのタップ先の操作は実行しない', () => {
    const clickStart = html.indexOf("historyModal.addEventListener('click'");
    const clickHandler = html.slice(clickStart, clickStart + 500);

    expect(clickStart).toBeGreaterThan(-1);
    expect(clickHandler).toContain("historyModal.classList.remove('frames-hidden')");
    expect(clickHandler).toContain('e.preventDefault()');
    expect(clickHandler).toContain('e.stopPropagation()');
    expect(clickHandler).toContain('}, true)');
  });

  it('最大化解除またはモーダル終了時にframes-hiddenをリセットする', () => {
    const fullscreenClick = html.slice(html.indexOf("historyModalFullscreenBtn.addEventListener('click'"), html.indexOf("historyModalFullscreenBtn.addEventListener('click'") + 450);
    const closeFunction = html.slice(html.indexOf('function closeHistoryModal()'), html.indexOf('function closeHistoryModal()') + 500);

    expect(fullscreenClick).toContain("if (!isFullscreen) historyModal.classList.remove('frames-hidden')");
    expect(closeFunction).toContain("historyModal.classList.remove('frames-hidden')");
  });
});
