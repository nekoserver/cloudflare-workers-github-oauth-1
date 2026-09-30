import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import app from './index';
import { createJWT } from './utils/jwt';
import { getPicorubyWasmPage, preparePicorubyIrbHtml } from './views/picorubyWasm';
import { findWasmModule, WASM_MODULE_REGISTRY } from './data/wasmModuleRegistry';

describe('PicoRuby/WASM IRB page', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is listed once in the WASM module catalog with its upstream source', () => {
    expect(WASM_MODULE_REGISTRY.filter((module) => module.id === 'picoruby')).toHaveLength(1);
    expect(findWasmModule('picoruby')).toMatchObject({
      repoFullName: 'picoruby/wasm',
      sourceFile: 'README.md',
    });
  });
  it('embeds the official PicoRuby WASM IRB through the same-origin endpoint', () => {
    const html = getPicorubyWasmPage('rubyist');

    expect(html).toContain('src="/picoruby-wasm/irb/"');
    expect(html).toContain('title="PicoRuby WebAssembly IRB"');
    expect(html).not.toContain('sandbox=');
    expect(html).toContain('referrerpolicy="no-referrer"');
  });

  it('resolves relative upstream assets against the official distribution', () => {
    expect(preparePicorubyIrbHtml('<html><head><title>IRB</title></head></html>'))
      .toContain('<head><base href="https://picoruby.github.io/wasm/">');
    expect(preparePicorubyIrbHtml('<main>IRB</main>'))
      .toBe('<base href="https://picoruby.github.io/wasm/"><main>IRB</main>');
  });

  it('rewrites root-relative GitHub Pages assets that a base element cannot resolve', () => {
    const upstreamHtml = `<html><head>
      <script type="module" src="/wasm/index.js"></script>
      <link href='/wasm/index.css' rel="stylesheet">
      <link href=/wasm/favicon.svg rel="icon">
      <style>.terminal { background: url(/wasm/background.png); }</style>
      <script>const worker = \`/wasm/worker.js\`;</script>
    </head></html>`;

    const html = preparePicorubyIrbHtml(upstreamHtml);

    expect(html).not.toMatch(/(?:["'`(=])\/wasm\//);
    expect(html).toContain('src="https://picoruby.github.io/wasm/index.js"');
    expect(html).toContain("href='https://picoruby.github.io/wasm/index.css'");
    expect(html).toContain('href=https://picoruby.github.io/wasm/favicon.svg');
    expect(html).toContain('url(https://picoruby.github.io/wasm/background.png)');
    expect(html).toContain('`https://picoruby.github.io/wasm/worker.js`');
  });

  it('prevents the top-level IRB document from being framed', () => {
    const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    expect(indexSource).toContain("headers.set('X-Frame-Options', 'DENY')");
    expect(indexSource).toContain("frame-ancestors 'none'");
    expect(indexSource).toContain("'wasm-unsafe-eval'");
  });

  it('permits the JavaScript and worker features used while PicoRuby boots', () => {
    const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    // wasm-unsafe-eval does not cover Emscripten's generated JavaScript or
    // blob workers. Blocking either stops startup before prompt('>') runs.
    expect(indexSource).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'");
    expect(indexSource).toContain("worker-src 'self' blob:");
    expect(indexSource).toContain("connect-src 'self' https:");
    expect(indexSource).toContain("'Cache-Control': 'no-store'");
  });

  it('proxies modules, workers, and WASM from the same-origin IRB directory', () => {
    const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    expect(indexSource).toContain("app.get('/picoruby-wasm/irb', authMiddleware, proxyPicorubyIrbDocument)");
    expect(indexSource).toContain("app.get('/picoruby-wasm/irb/', authMiddleware, proxyPicorubyIrbDocument)");
    expect(indexSource).toContain("app.get('/picoruby-wasm/irb/*', authMiddleware");
    expect(indexSource).toContain("new URL(assetPath, PICORUBY_WASM_IRB_URL)");
    expect(indexSource).toContain("upstream.headers.get('Content-Type')");
  });

  it('serves the stable application shell at the public page route', () => {
    const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    expect(indexSource).toContain("app.get('/picoruby-wasm', authMiddleware, async (c) => {");
    expect(indexSource).toContain('return c.html(getPicorubyWasmPage(user.sub));');
    expect(indexSource).toContain("frame-src 'self' https://picoruby.github.io");
    expect(indexSource).toContain("base-uri https://picoruby.github.io");
    expect(indexSource).toContain("frame-ancestors 'none'");
  });

  it.each(['/picoruby-wasm/irb', '/picoruby-wasm/irb/'])(
    'returns the upstream IRB document at %s instead of a 404',
    async (path) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
        '<html><head></head><body>PicoRuby IRB</body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } },
      )));
      const token = await createJWT({ sub: 'rubyist' }, 'test-secret');

      const response = await app.request(path, {
        headers: { Authorization: `Bearer ${token}` },
      }, { JWT_SECRET: 'test-secret' });

      expect(response.status).toBe(200);
      expect(await response.text()).toContain('PicoRuby IRB');
      expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    },
  );

  it('keeps the page available and redirects the IRB frame when the Worker receives an upstream 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 })));
    const token = await createJWT({ sub: 'rubyist' }, 'test-secret');
    const request = (path: string) => app.request(path, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
    }, { JWT_SECRET: 'test-secret' });

    const pageResponse = await request('/picoruby-wasm');
    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain('ブラウザで PicoRuby IRB');

    const irbResponse = await request('/picoruby-wasm/irb/');
    expect(irbResponse.status).toBe(302);
    expect(irbResponse.headers.get('Location')).toBe('https://picoruby.github.io/wasm/');
  });

  it('has a 44px sticky header and hides the loading state after IRB loads', () => {
    const html = getPicorubyWasmPage('rubyist');

    expect(html).toMatch(/position: sticky; top: 0; z-index: 10; height: 44px/);
    expect(html).toContain("frame.addEventListener('load', function () { loading.hidden = true; });");
  });

  it('escapes the displayed username', () => {
    const html = getPicorubyWasmPage('<script>alert(1)</script>');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
