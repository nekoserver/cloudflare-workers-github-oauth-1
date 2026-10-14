import { describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { getAiChatPage } from './views/aichat';
import { existsSync, writeFileSync } from 'node:fs';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync('/root/.cache/ms-playwright/chrome') ? '/root/.cache/ms-playwright/chrome' : chromium.executablePath());

describe('AIチャット通常画面の文字サイズ', () => {
  it.skipIf(!existsSync(executablePath))('ライト・ダークで質問と回答を12px、入力を12pxに表示する', async () => {
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const html = getAiChatPage({ username: 'preview-user', aiChatModel: 'codex' });
      writeFileSync('/tmp/aichat-normal-preview.html', html);
      await page.route('**/*', route => route.abort());
      await page.setContent(html);
      await page.locator('#chatLog').evaluate(node => { node.innerHTML = '<div class="chat-bubble user preview-area">小さい文字の質問です。</div><div class="chat-bubble assistant preview-area"><h2>確認用の回答</h2><p>本文が読めることを確認します。</p><pre><code>example()</code></pre><table><tr><th>項目</th><th>値</th></tr><tr><td>サイズ</td><td>小</td></tr></table></div>'; });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
        expect(await page.locator('.chat-bubble.user').evaluate(node => getComputedStyle(node).fontSize)).toBe('12px');
        expect(await page.locator('.chat-bubble.assistant').evaluate(node => getComputedStyle(node).fontSize)).toBe('12px');
        expect(await page.locator('#chatInput').evaluate(node => getComputedStyle(node).fontSize)).toBe('12px');
        await page.screenshot({ path: `/tmp/aichat-normal-${theme}.png` });
      }
    } finally { await browser.close(); }
  });
});
