import { describe, expect, it } from 'vitest';
import { getPicorubyWasmPage } from './views/picorubyWasm';

describe('PicoRuby/WASM IRB page', () => {
  it('embeds the official PicoRuby WASM IRB with a restricted sandbox', () => {
    const html = getPicorubyWasmPage('rubyist');

    expect(html).toContain('src="https://picoruby.github.io/wasm/"');
    expect(html).toContain('title="PicoRuby WebAssembly IRB"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-forms"');
    expect(html).toContain('referrerpolicy="no-referrer"');
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
