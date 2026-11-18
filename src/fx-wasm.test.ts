import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { getWasmModulesPage } from './views/wasmModules';
import { getFxWasmPage } from './views/fxWasm';
import app from './index';
import { createJWT } from './utils/jwt';

describe('fx WASM sample', () => {
  it('requires login for the sample page', async () => {
    const response = await app.request('/fx-wasm', {}, { JWT_SECRET: 'test-secret' });
    expect([302, 401]).toContain(response.status);
  });
  it('serves the authenticated page with WASM allowed and no inline script execution', async () => {
    const secret = 'fx-test-secret';
    const token = await createJWT({ sub: 'fx-user', github_id: 2 }, secret);
    const DB = { prepare: () => ({ bind: () => ({ first: async () => ({ revoked_at: null }) }) }) };
    const response = await app.request('/fx-wasm', { headers: { Authorization: `Bearer ${token}` } }, { JWT_SECRET: secret, DB });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const policy = response.headers.get('Content-Security-Policy')!;
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval';");
    expect(policy).toContain("connect-src 'self' https://ai-gateway.vercel.sh");
    expect(await response.text()).toContain('fx WASM');
  });
  it('explains the simulated model and loads self-hosted scripts', () => {
    const html = getFxWasmPage();
    expect(html).toContain('模擬モデル');
    expect(html).toContain('/fx-wasm.mjs');
    expect(html).toContain('type="password"');
    expect(html).not.toContain('https://cdn');
  });
  it('keeps rendered scripts valid and exposes the sample link', () => {
    const html = getWasmModulesPage('test-user');
    expect(html).toContain('href="/fx-wasm"');
    for (const page of [html, getFxWasmPage()]) {
      for (const match of page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (/\bsrc=/.test(match[1]) || !match[2].trim()) continue;
        const checked = spawnSync(process.execPath, ['--check'], { input: match[2], encoding: 'utf8' });
        expect(checked.stderr).toBe('');
        expect(checked.status).toBe(0);
      }
    }
  });
  it('pins the official prebuilt module and its checksum', () => {
    const manifest = JSON.parse(readFileSync('public/vendor/libfx/manifest.json', 'utf8'));
    expect(manifest.version).toBe('0.0.16');
    expect(manifest.files['fx-core.wasm']).toMatch(/^[a-f0-9]{64}$/);
  });
});
