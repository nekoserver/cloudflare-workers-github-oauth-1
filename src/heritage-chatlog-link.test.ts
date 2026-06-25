import { describe, it, expect } from 'vitest';
import { getHeritageAccessPage } from './views/heritageAccess';

function buildPage(): string {
  return getHeritageAccessPage('testuser');
}

describe('世界遺産チャットログリンク: モーダルHTML', () => {
  it('heritage-chatlog-modal が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="heritage-chatlog-modal"');
  });

  it('heritage-chatlog-modal-body が存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="heritage-chatlog-modal-body"');
  });

  it('heritage-chatlog-modal の閉じるボタンが存在する', () => {
    const html = buildPage();
    expect(html).toContain('id="heritage-chatlog-close"');
  });
});

describe('世界遺産チャットログリンク: CSS', () => {
  it('.acc-name-link クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.acc-name-link');
  });

  it('.hcl-entry クラスが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.hcl-entry');
  });
});

describe('世界遺産チャットログリンク: JavaScript関数', () => {
  it('checkHeritageKeywords 関数が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('function checkHeritageKeywords');
  });

  it('openHeritageChatlogModal 関数が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('function openHeritageChatlogModal');
  });

  it('/api/aichat/heritage-keywords-check を呼んでいる', () => {
    const html = buildPage();
    expect(html).toContain('/api/aichat/heritage-keywords-check');
  });

  it('/api/aichat/shares/by-keyword を呼んでいる', () => {
    const html = buildPage();
    expect(html).toContain('/api/aichat/shares/by-keyword');
  });

  it('acc-name-link クラスをアコーディオン内で付与している', () => {
    const html = buildPage();
    expect(html).toContain('acc-name-link');
    const idx = html.indexOf('checkHeritageKeywords');
    expect(idx).toBeGreaterThan(-1);
  });
});

describe('世界遺産チャットログリンク: getNextZ', () => {
  it('heritage-chatlog-modal が getNextZ() で z-index を設定している', () => {
    const html = buildPage();
    const idx = html.indexOf('openHeritageChatlogModal');
    expect(idx).toBeGreaterThan(-1);
    const fn = html.slice(idx, idx + 400);
    expect(fn).toContain('getNextZ()');
  });
});
