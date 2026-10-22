import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const view = readFileSync('src/views/cfContainers.ts', 'utf8');

describe('/cf-containers のページ内メニュー', () => {
  it('各セクションへのリンクと、行末の▲▼トグルを持つ', () => {
    expect(view).toContain('id="page-menu"');
    expect(view).toContain('class="menu-toggle"');
    for (const name of ['secrets', 'control', 'health', 'report', 'net', 'buildlog', 'tunnels']) {
      expect(view).toContain(`href="#sec-${name}"`);
      expect(view).toContain(`id="sec-${name}"`);
    }
  });
  it('開いている間は▲、閉じたら▼に戻る', () => {
    expect(view).toContain("btn.textContent = '\u25b2';");
    expect(view).toContain("b.textContent = '\u25bc';");
  });
  it('トグルで最上位のモーダルに現在の設定状況を出し、「変更する」で該当セクションへ飛ぶ', () => {
    expect(view).toContain('id="menu-modal"');
    expect(view).toContain('id="menu-change"');
    expect(view).toContain("document.getElementById('menu-change').addEventListener");
    expect(view).toContain('section.scrollIntoView');
  });
  it('モーダルのz-indexは固定値ではなくgetNextZ()で動的に決める', () => {
    expect(view).toContain('function getNextZ()');
    expect(view).toContain("menuModal.style.zIndex = String(getNextZ())");
    expect(view).not.toMatch(/z-index:\s*\d{3,}/);
  });
});
