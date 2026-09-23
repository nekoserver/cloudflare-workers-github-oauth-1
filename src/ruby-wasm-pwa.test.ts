import { describe, expect, it } from 'vitest';
import { getRubyWasmPage } from './views/rubyWasm';

describe('/ruby-wasm PWA表示', () => {
  const html = getRubyWasmPage('tester');

  it('専用manifestを使いstandaloneアプリとして設定する', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest-ruby-wasm.json">');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes">');
  });

  it('standalone表示で右上のユーザー名とアバターメニューを隠す', () => {
    expect(html).toContain('@media (display-mode: standalone) { .pwa-hide { display: none !important; } }');
    expect(html).toContain('<span class="user-name pwa-hide">tester</span>');
    expect(html).toContain('<div class="user-menu-container pwa-hide">');
  });
});
