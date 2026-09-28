import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { renderKeyPickerHtml, renderKeyPickerJs } from './keywordPickerWidget';

function setup() {
  const dom = new JSDOM(`<!doctype html><body><input id="query"><button id="open">選択</button>${renderKeyPickerHtml()}</body>`, {
    runScripts: 'dangerously',
  });
  (dom.window as any).fetch = vi.fn(() => new Promise(() => {}));
  dom.window.eval(renderKeyPickerJs({ targetInputId: 'query', triggerBtnId: 'open' }));
  return dom.window;
}

describe('keyword picker accessibility contract', () => {
  it('triggerとpickerを関連付け、dialogにaccessible nameを持たせる', () => {
    const window = setup();
    const trigger = window.document.getElementById('open')!;
    const dialog = window.document.querySelector('[role="dialog"]')!;

    expect(trigger.getAttribute('aria-controls')).toBe('kpOverlay');
    expect(dialog.getAttribute('aria-labelledby')).toBe('kpTitle');
    expect(window.document.getElementById('kpTitle')!.textContent).toContain('検索キーワードを選ぶ');
  });

  it('開閉時にtriggerのaria-expandedを同期する', () => {
    const window = setup();
    const trigger = window.document.getElementById('open')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    window.document.getElementById('kpCloseBtn')!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
