import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getCfContainersPage } from './cfContainers';

// /cf-containers のApacheヘルプのモーダル(iframeでマニュアルを出すウィンドウ)の操作(ユーザー指定 2026-11-15):
// - 「閉じる」の右に「⬜︎」を置き、押すと最大化と元のサイズを切り替える。2つのボタンは常にタイトルバーの右端
// - 四隅のドラッグで大きさを変えられる。大きさ(幅と高さ)はCookieに保存し、次に開いたときに使う
// - タイトルバーのダブルタップ(ダブルクリック)で、一時的にタイトルバーだけにする/元に戻す
//
// 故障シナリオ:
//   (1) タイトルが長いとボタンが右端から押し出される、または折り返して2段になる
//   (2) 最大化が戻らない、または最大化・タイトルバーだけの状態が保存されて次も続く
//   (3) 隅のドラッグで反対側の隅まで動く(左上の隅で右下が動く等)、小さくしすぎて操作できなくなる
//   (4) ドラッグの終わりにウィンドウの外で指を離すと、背景のクリックとみなされてヘルプが閉じる
//   (5) ドラッグ中にiframeがポインタを奪い、動かなくなる
//   (6) Cookieの値が壊れている・画面より大きいと、はみ出したウィンドウになる

const COOKIE = 'cfc_apache_help_size';

function setup(cookie?: string) {
  const html = getCfContainersPage();
  const markup = html.match(/<table class="health-table" id="apache-modules-table"[\s\S]*?<!-- \/apache-module-modals -->/)?.[0];
  const script = html.match(/<script id="apache-modules-panel">([\s\S]*?)<\/script>/)?.[1];
  const css = html.match(/<style>([\s\S]*?)<\/style>/)![1];
  expect(markup).toBeTruthy();
  const dom = new JSDOM('<!doctype html><body>' + markup + '</body>', { url: 'https://example.test/cf-containers', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window as any;
  if (cookie) dom.window.document.cookie = cookie;
  const writes: string[] = [];
  const doc = dom.window.document;
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(doc), 'cookie')!;
  Object.defineProperty(doc, 'cookie', { configurable: true, get: () => desc.get!.call(doc), set: (v: string) => { writes.push(v); desc.set!.call(doc, v); } });
  win.fetch = async () => ({ ok: true, status: 200, json: async () => ({ apacheVersion: '2.4.71', modules: {} }) });
  dom.window.eval(script!);
  win.cfcApacheModules.openHelp('/apache-manual/2.4.71/mod/mod_ssl.html', 'Apache Module mod_ssl');
  const panel = doc.querySelector('.apache-help-panel') as HTMLDivElement;
  const modal = doc.getElementById('apache-help-modal') as HTMLDivElement;
  const bar = doc.getElementById('apache-help-bar') as HTMLDivElement;
  const maxButton = doc.getElementById('apache-help-maximize') as HTMLButtonElement;
  const px = (v: string) => Number(v.replace('px', ''));
  const box = () => ({ left: px(panel.style.left), top: px(panel.style.top), width: px(panel.style.width), height: px(panel.style.height) });
  const fire = (target: EventTarget, type: string, x: number, y: number, pointerType = 'mouse') => {
    const ev = new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    Object.defineProperty(ev, 'pointerType', { value: pointerType });
    target.dispatchEvent(ev);
  };
  const drag = (corner: string, dx: number, dy: number) => {
    const handle = panel.querySelector(`.help-resize[data-corner="${corner}"]`)!;
    fire(handle, 'pointerdown', 500, 400);
    fire(doc, 'pointermove', 500 + dx, 400 + dy);
    fire(doc, 'pointerup', 500 + dx, 400 + dy);
  };
  return { dom, win, doc, css, panel, modal, bar, maxButton, box, drag, fire, writes };
}

describe('タイトルバーのボタン', () => {
  it('「閉じる」の右に「⬜︎」があり、2つは右端に寄せた枠に入っている', () => {
    const { doc, css, bar, maxButton } = setup();
    const actions = doc.getElementById('apache-help-actions')!;
    expect([...actions.children].map((b) => b.id)).toEqual(['apache-help-close', 'apache-help-maximize']);
    expect(maxButton.textContent).toBe('⬜︎');
    expect(bar.lastElementChild).toBe(actions);
    expect(css).toMatch(/#apache-help-actions \{[^}]*margin-left: auto/);
    expect(css).toMatch(/#apache-help-bar \{[^}]*flex-wrap: nowrap/);
    expect(css).toMatch(/#apache-help-title \{[^}]*text-overflow: ellipsis/);
  });

  it('「⬜︎」で最大化し、もう一度押すと元の大きさと位置に戻る。最大化は保存しない', () => {
    const { panel, maxButton, box, writes } = setup();
    const before = box();
    maxButton.click();
    expect(panel.classList.contains('maximized')).toBe(true);
    expect(maxButton.getAttribute('aria-pressed')).toBe('true');
    maxButton.click();
    expect(panel.classList.contains('maximized')).toBe(false);
    expect(maxButton.getAttribute('aria-pressed')).toBe('false');
    expect(box()).toEqual(before);
    expect(writes.filter((w) => w.startsWith(COOKIE))).toEqual([]);
  });
});

describe('四隅のドラッグで大きさを変える', () => {
  it('開いたときは画面の中央に、既定の大きさで置く', () => {
    const { box, win } = setup();
    const b = box();
    expect(b.width).toBe(Math.min(960, win.innerWidth - 32));
    expect(b.left).toBe(Math.round((win.innerWidth - b.width) / 2));
  });

  it('右下の隅で幅と高さが増え、左上の位置は動かない。大きさをCookieに1年保存する', () => {
    const { box, drag, writes } = setup();
    const before = box();
    drag('se', -100, -50);
    const after = box();
    expect(after).toEqual({ left: before.left, top: before.top, width: before.width - 100, height: before.height - 50 });
    const saved = writes.filter((w) => w.startsWith(COOKIE + '=')).at(-1)!;
    expect(saved).toContain(`${COOKIE}=${after.width}x${after.height}`);
    expect(saved).toContain('Max-Age=31536000');
    expect(saved).toContain('Path=/cf-containers');
  });

  it('左上の隅では右下の隅を固定したまま、左上が動く', () => {
    const { box, drag } = setup();
    const before = box();
    drag('nw', 40, 30);
    const after = box();
    expect(after.left).toBe(before.left + 40);
    expect(after.top).toBe(before.top + 30);
    expect(after.left + after.width).toBe(before.left + before.width);
    expect(after.top + after.height).toBe(before.top + before.height);
  });

  it('右上・左下の隅も、それぞれ反対の隅を固定して動く', () => {
    const ne = setup();
    const b1 = ne.box();
    ne.drag('ne', -20, 20);
    const a1 = ne.box();
    expect(a1.left).toBe(b1.left);
    expect(a1.top + a1.height).toBe(b1.top + b1.height);
    expect(a1.width).toBe(b1.width - 20);
    const sw = setup();
    const b2 = sw.box();
    sw.drag('sw', 20, -20);
    const a2 = sw.box();
    expect(a2.top).toBe(b2.top);
    expect(a2.left + a2.width).toBe(b2.left + b2.width);
    expect(a2.height).toBe(b2.height - 20);
  });

  it('小さくしすぎない(幅280・高さ160より小さくならない)', () => {
    const { box, drag } = setup();
    drag('se', -5000, -5000);
    expect(box().width).toBe(280);
    expect(box().height).toBe(160);
  });

  it('ドラッグの終わりにウィンドウの外で指を離しても、ヘルプは閉じない', () => {
    const { modal, panel, fire, doc } = setup();
    const handle = panel.querySelector('.help-resize[data-corner="se"]')!;
    fire(handle, 'pointerdown', 500, 400);
    fire(doc, 'pointermove', 900, 700);
    fire(doc, 'pointerup', 900, 700);
    modal.click();
    expect(modal.hidden).toBe(false);
    modal.click();
    expect(modal.hidden).toBe(true);
  });

  it('ドラッグ中はiframeがポインタを奪わないようにする', () => {
    const { panel, fire, doc, css } = setup();
    fire(panel.querySelector('.help-resize[data-corner="se"]')!, 'pointerdown', 500, 400);
    expect(panel.classList.contains('resizing')).toBe(true);
    expect(css).toMatch(/\.apache-help-panel\.resizing iframe \{[^}]*pointer-events: none/);
    fire(doc, 'pointerup', 500, 400);
    expect(panel.classList.contains('resizing')).toBe(false);
  });

  it('保存した大きさで開き、壊れた値や画面より大きい値は使わない・縮める', () => {
    expect(setup(`${COOKIE}=700x500`).box()).toMatchObject({ width: 700, height: 500 });
    const broken = setup(`${COOKIE}=abc`);
    expect(broken.box().width).toBe(Math.min(960, broken.win.innerWidth - 32));
    const huge = setup(`${COOKIE}=99999x99999`);
    expect(huge.box().width).toBe(huge.win.innerWidth - 16);
    expect(huge.box().height).toBe(huge.win.innerHeight - 16);
  });
});

describe('タイトルバーのダブルタップ', () => {
  it('ダブルクリックでタイトルバーだけになり、もう一度で戻る。保存はしない', () => {
    const { bar, panel, win, writes } = setup();
    bar.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
    expect(panel.classList.contains('collapsed')).toBe(true);
    bar.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
    expect(panel.classList.contains('collapsed')).toBe(false);
    expect(writes.filter((w) => w.startsWith(COOKIE))).toEqual([]);
  });

  it('タッチでは、続けて2回タップするとタイトルバーだけになる', () => {
    const { bar, panel, fire } = setup();
    fire(bar, 'pointerup', 10, 10, 'touch');
    expect(panel.classList.contains('collapsed')).toBe(false);
    fire(bar, 'pointerup', 10, 10, 'touch');
    expect(panel.classList.contains('collapsed')).toBe(true);
  });

  it('ボタンのダブルクリックでは畳まない。タイトルバーだけの間はiframeと隅のつまみを隠す', () => {
    const { maxButton, panel, win, bar, css } = setup();
    maxButton.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
    expect(panel.classList.contains('collapsed')).toBe(false);
    bar.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
    expect(css).toMatch(/\.apache-help-panel\.collapsed iframe, \.apache-help-panel\.collapsed \.help-resize \{[^}]*display: none/);
  });

  it('閉じて開き直すと、タイトルバーだけ・最大化の状態は解除される', () => {
    const { bar, panel, win, maxButton, doc } = setup();
    bar.dispatchEvent(new win.MouseEvent('dblclick', { bubbles: true }));
    maxButton.click();
    (doc.getElementById('apache-help-close') as HTMLButtonElement).click();
    win.cfcApacheModules.openHelp('/apache-manual/2.4.71/mod/mod_ssl.html', 'Apache Module mod_ssl');
    expect(panel.classList.contains('collapsed')).toBe(false);
    expect(panel.classList.contains('maximized')).toBe(false);
  });
});
