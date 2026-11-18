import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const name of ['tree', 'msb', 'sqlx']) {
  const script = readFileSync(new URL(`./build-${name}-wasm.sh`, import.meta.url), 'utf8');
  const lock = readFileSync(new URL(`../wasm/${name}-wasm/Cargo.lock`, import.meta.url), 'utf8');
  test(`${name}: bindgen CLI matches the locked WASM schema`, () => {
    const locked = lock.match(/name = "wasm-bindgen"\nversion = "([^"]+)"/)[1];
    const cli = script.match(/(?:bindgen_version|WASM_BINDGEN_VERSION)="([^"]+)"/)[1];
    assert.equal(cli, locked);
  });
  test(`${name}: tests and rebuilds preserve the dependency lock`, () => {
    const commands = script.split('\n').filter(line => /^cargo (?:test|build)\b/.test(line));
    assert.equal(commands.length, 2);
    for (const command of commands) {
      assert.match(command, /--locked\b/);
    }
  });
}
