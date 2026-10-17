/** 実ブラウザで、埋め込みフォームからHMAC照合までの経路を検証する。 */
import assert from 'node:assert/strict';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { chromium } from 'playwright';
import { getConversationStreamPanel, getConversationStreamToggle } from '../src/views/conversationStreamPanel.ts';

const secret = 'stream-panel-browser-test-key';
const origin = 'https://mygw.nekomaneki.work';
const endpoint = '/lib/api/chat/session';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const protocol of ['websocket', 'sse']) {
    for (const action of ['enter', 'button']) {
      const page = await browser.newPage();
      const requests: boolean[] = [];
      const blocked: string[] = [];
      page.on('console', message => {
        if (message.text().includes('Blocked form submission')) blocked.push(message.text());
      });
      await page.route('https://panel.example/**', route => {
        if (route.request().url().endsWith('/health')) return route.fulfill({ json: { healthy: true, availableHosts: ['mygw'] } });
        return route.fulfill({ contentType: 'text/html', body: getConversationStreamToggle() + getConversationStreamPanel() });
      });
      await page.route(origin + '/**', async route => {
        const request = route.request();
        if (new URL(request.url()).pathname === endpoint) {
          assert.equal(request.method(), 'POST');
          const body = request.postData() || '';
          assert.deepEqual(JSON.parse(body), { type: 'observe' });
          const timestamp = request.headers()['x-timestamp'];
          assert.ok(Math.abs(Date.now() / 1000 - Number(timestamp)) < 300);
          const canonical = ['POST', endpoint, timestamp, createHash('sha256').update(body).digest('hex')].join('\n');
          const expected = createHmac('sha256', secret).update(canonical).digest();
          const received = Buffer.from(request.headers()['x-signature'] || '', 'hex');
          const valid = received.length === expected.length && timingSafeEqual(received, expected);
          requests.push(valid);
          return route.fulfill({ status: valid ? 200 : 401, json: valid ? { token: 'observation-only' } : { error: 'authentication_failed' } });
        }
        // 認証サービスのフォーム契約を再現。署名は実際のWebCryptoで作る。
        return route.fulfill({ contentType: 'text/html', body: `<!doctype html><form id="auth">
          <label>HMACキー<input id="key" type="password"></label><button>照合</button>
          </form><output id="result"></output><script>
          window.addEventListener('message', event => {
            if (event.source === parent && event.origin === 'https://panel.example' && event.data.type === 'conversation-controls')
              parent.postMessage({ type: 'conversation-state', busy: false }, event.origin);
          });
          document.querySelector('form').addEventListener('submit', async event => {
            event.preventDefault();
            const enc = new TextEncoder(), body = JSON.stringify({ type: 'observe' });
            const hex = value => [...new Uint8Array(value)].map(b => b.toString(16).padStart(2, '0')).join('');
            const timestamp = String(Math.floor(Date.now() / 1000));
            const key = await crypto.subtle.importKey('raw', enc.encode(document.querySelector('input').value), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
            const hash = hex(await crypto.subtle.digest('SHA-256', enc.encode(body)));
            const canonical = ['POST', '${endpoint}', timestamp, hash].join('\\n');
            const signature = hex(await crypto.subtle.sign('HMAC', key, enc.encode(canonical)));
            const response = await fetch('${endpoint}', { method: 'POST', body, headers: { 'X-Timestamp': timestamp, 'X-Signature': signature } });
            document.querySelector('output').textContent = response.status === 200 ? 'authenticated' : 'rejected';
          });</script>` });
      });
      try {
        await page.goto('https://panel.example/aichat');
        await page.locator('#conversationStreamToggle').click();
        if (protocol === 'sse') await page.locator('[data-conversation-protocol="sse"]').click();
        await page.locator('#conversationStreamStart:not([disabled])').waitFor();
        const frame = page.frameLocator('#conversationStreamFrame');
        await frame.locator('#key').fill(secret);
        if (action === 'enter') await frame.locator('#key').press('Enter');
        else await frame.locator('button').click();
        try {
          await frame.locator('#result').filter({ hasText: 'authenticated' }).waitFor({ timeout: 3000 });
        } catch (error) {
          throw new Error(`${protocol}/${action}: 認証要求が到達しない。sandboxのフォーム拒否: ${blocked.length}`, { cause: error });
        }
        assert.deepEqual(requests, [true]);
        await frame.locator('#key').fill('wrong-key');
        if (action === 'enter') await frame.locator('#key').press('Enter');
        else await frame.locator('button').click();
        await frame.locator('#result').filter({ hasText: 'rejected' }).waitFor();
        assert.deepEqual(requests, [true, false]);
        assert.equal(blocked.length, 0);
        console.log(`${protocol}/${action}: 正しいHMACは成功、不正なHMACは拒否`);
      } finally { await page.close(); }
    }
  }
} finally { await browser.close(); }
