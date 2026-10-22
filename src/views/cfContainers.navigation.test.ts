import { describe, it, expect } from 'vitest';
import { getCfContainersPage } from './cfContainers';

describe('コンテナ管理のセクション移動', () => {
  it('左パネルに全セクションへの有効なリンクを表示する', () => {
    const html = getCfContainersPage();
    const nav = html.match(/<aside[\s\S]*?<\/aside>/)?.[0] || '';
    const sections = [...html.matchAll(/<details[^>]*data-section="([^"]+)"/g)];
    expect(sections.length).toBeGreaterThan(0);
    for (const [, key] of sections) {
      expect(nav).toContain(`href="#section-${key}"`);
      expect(html).toContain(`id="section-${key}"`);
    }
  });
  it('折りたたまれた親も開いてから移動し、対象にフォーカスする', () => {
    const html = getCfContainersPage();
    const script = html.match(/<script id="section-navigation">([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeTruthy();
    let onClick: any;
    const parent = { open: false, parentElement: null, tagName: 'DETAILS' };
    const target = { open: false, parentElement: parent, tagName: 'DETAILS', focus: () => {}, scrollIntoView: () => {} };
    let focused = false;
    let scrolled = false;
    target.focus = () => { focused = true; };
    target.scrollIntoView = () => { scrolled = true; };
    const link = { hash: '#section-pricing', addEventListener: (_: string, cb: any) => { onClick = cb; } };
    const doc = { querySelectorAll: () => [link], getElementById: () => target };
    new Function('document', 'window', script!)(doc, { location: { hash: '' }, addEventListener: () => {} });
    onClick();
    expect(target.open).toBe(true);
    expect(parent.open).toBe(true);
    expect(focused && scrolled).toBe(true);
  });
});
