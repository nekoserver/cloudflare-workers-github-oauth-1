import { describe, expect, it } from 'vitest';
import { getWelcomePage } from './views/welcome';

const user = {
  username: 'octocat',
  name: 'Octo Cat',
};

describe('getWelcomePage: 最上部の帯とPWA表示', () => {
  it('最上部の帯は44px高で画面上部に固定される', () => {
    const html = getWelcomePage(user);

    expect(html).toMatch(/\.navbar\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;[^}]*z-index:\s*200;/s);
    expect(html).toMatch(/\.navbar\s*\{[^}]*padding:\s*0 20px;[^}]*height:\s*44px;/s);
    expect(html).toMatch(/\.user-icon\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
  });

  it('PWAのstandalone表示では画面右上のログインユーザー名を隠す', () => {
    const html = getWelcomePage(user);

    expect(html).toContain('@media (display-mode: standalone) { .pwa-hide { display: none !important; } }');
    expect(html).toContain('<span class="user-name pwa-hide">Octo Cat</span>');
  });
});
