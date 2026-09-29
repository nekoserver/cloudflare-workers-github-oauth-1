import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getPicorubyWasmPage, preparePicorubyIrbHtml } from './views/picorubyWasm';

describe('PicoRuby/WASM IRB page', () => {
  it('embeds the official PicoRuby WASM IRB through the same-origin endpoint', () => {
    const html = getPicorubyWasmPage('rubyist');

    expect(html).toContain('src="/picoruby-wasm/irb/"');
    expect(html).toContain('title="PicoRuby WebAssembly IRB"');
    expect(html).not.toContain('sandbox=');
    expect(html).toContain('referrerpolicy="no-referrer"');
  });

  it('keeps relative upstream assets on the official PicoRuby site', () => {
    expect(preparePicorubyIrbHtml('<html><head><title>IRB</title></head></html>'))
      .toContain('<head><base href="https://picoruby.github.io/wasm/">');
    expect(preparePicorubyIrbHtml('<main>IRB</main>'))
      .toBe('<base href="https://picoruby.github.io/wasm/"><main>IRB</main>');
  });

  it('allows only the proxied IRB response to be framed by this origin', () => {
    const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    expect(indexSource).toContain("c.req.path === '/picoruby-wasm/irb/' ? 'SAMEORIGIN' : 'DENY'");
    expect(indexSource).toContain("frame-ancestors 'self'");
    expect(indexSource).toContain("'wasm-unsafe-eval'");
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
