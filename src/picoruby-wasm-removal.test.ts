import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WASM_MODULE_REGISTRY } from './data/wasmModuleRegistry';

describe('unsupported PicoRuby WASM integration', () => {
  it('does not advertise PicoRuby as an available WASM module', () => {
    expect(WASM_MODULE_REGISTRY.some((module) => module.id === 'picoruby')).toBe(false);
  });

  it('does not expose a page or proxy for the unavailable upstream IRB', () => {
    const indexSource = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

    expect(indexSource).not.toContain("app.get('/picoruby-wasm'");
    expect(indexSource).not.toContain("app.get('/picoruby-wasm/irb");
    expect(indexSource).not.toContain('picoruby.github.io/wasm');
  });

  it('does not offer an installer for an unsupported IRB environment', () => {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts).not.toHaveProperty('picoruby:install');
  });
});
