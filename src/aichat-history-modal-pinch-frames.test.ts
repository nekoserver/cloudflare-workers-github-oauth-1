import { describe, expect, it } from 'vitest';
import { getAiChatPage } from './views/aichat';

const html = getAiChatPage({
  username: 'testuser',
  aiChatModel: 'claude-sonnet-4-6',
});

describe('詳細プレビューモーダル: 最大化中のピンチアウト表示', () => {
  it('最大化中にframes-hiddenを付けると上下のフレームだけを非表示にする', () => {
    expect(html).toContain('.history-modal.fullscreen.frames-hidden > .history-modal-head');
    expect(html).toContain('.history-modal.fullscreen.frames-hidden > .history-modal-foot');
  });

  it('2本指の間隔が24pxを超えて広がったときだけフレームを隠す', () => {
    const touchStart = html.indexOf("historyModalChat.addEventListener('touchstart'");
    const touchEnd = html.indexOf("historyModalChat.addEventListener('touchend'", touchStart);
    const handlers = html.slice(touchStart, touchEnd + 500);

    expect(handlers).toContain("e.touches.length === 2 && historyModal.classList.contains('fullscreen')");
    expect(handlers).toContain('distance - historyPinchStartDistance > 24');
    expect(handlers).toContain("historyModal.classList.add('frames-hidden')");
    expect(handlers).toContain('if (historyPinchGestureActive)');
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
