import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { getModalRuntimeScript } from './modalRuntime';

function setup() {
  const dom = new JSDOM(`<!doctype html><body>
    <button id="opener-a">A</button><div id="a"><div id="panel-a"><button id="close-a">close</button></div></div>
    <button id="opener-b">B</button><div id="b"><div id="panel-b"></div></div>
  </body>`, { runScripts: 'dangerously', pretendToBeVisual: true });
  dom.window.eval(getModalRuntimeScript());
  const runtime = (dom.window as any).ModalRuntime;
  const a = runtime.register({
    id: 'a', overlay: dom.window.document.getElementById('a'),
    closeButtons: [dom.window.document.getElementById('close-a')],
  });
  const b = runtime.register({ id: 'b', overlay: dom.window.document.getElementById('b') });
  return { window: dom.window, runtime, a, b };
}

describe('getModalRuntimeScript', () => {
  it('is valid and installs one guarded global runtime', () => {
    expect(() => new Function(getModalRuntimeScript())).not.toThrow();
    const { window, runtime } = setup();
    window.eval(getModalRuntimeScript());
    expect((window as any).ModalRuntime).toBe(runtime);
  });

  it('closes only the topmost modal with Escape', () => {
    const { window, runtime, a, b } = setup();
    a.open();
    b.open();
    expect(runtime.topmost()).toBe('b');
    window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(b.isOpen()).toBe(false);
    expect(a.isOpen()).toBe(true);
    expect(runtime.topmost()).toBe('a');
  });

  it('closes on the backdrop but not on a panel click', () => {
    const { window, a } = setup();
    const overlay = window.document.getElementById('a')!;
    a.open();
    window.document.getElementById('panel-a')!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(a.isOpen()).toBe(true);
    overlay.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(a.isOpen()).toBe(false);
  });

  it('restores focus to the opener after close', () => {
    const { window, a } = setup();
    const opener = window.document.getElementById('opener-a') as HTMLButtonElement;
    const focus = vi.spyOn(opener, 'focus');
    opener.focus();
    a.open();
    window.document.getElementById('close-a')!.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(focus).toHaveBeenCalledTimes(2);
  });

  it('assigns increasing z-index values when modals are opened', () => {
    const { window, a, b } = setup();
    a.open();
    b.open();
    const aZ = Number((window.document.getElementById('a') as HTMLElement).style.zIndex);
    const bZ = Number((window.document.getElementById('b') as HTMLElement).style.zIndex);
    expect(bZ).toBeGreaterThan(aZ);
  });
});
