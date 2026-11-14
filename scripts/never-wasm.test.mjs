import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const { instance } = await WebAssembly.instantiate(await readFile(new URL('../public/rust-never-sample/never.wasm', import.meta.url)));
const wasm = instance.exports;
test('infallible and never Results agree at u32 boundaries', () => {
  for (const [input, expected] of [[0, 0], [42, 3], [43, 4], [2147483648, 1], [4294967295, 32]]) {
    assert.equal(wasm.count_ones_total(input), expected);
    assert.equal(wasm.count_via_infallible(input), expected);
  }
});
test('even inputs return; odd inputs trap; the same instance remains callable', () => {
  assert.equal(wasm.half_even_or_trap(0), 0);
  assert.equal(wasm.half_even_or_trap(4294967294), 2147483647);
  assert.throws(() => wasm.half_even_or_trap(43), WebAssembly.RuntimeError);
  assert.equal(wasm.half_even_or_trap(42), 21);
});
test('displayed Rust source is the actual compilation input', async () => {
  assert.deepEqual(await readFile(new URL('../wasm/never-wasm/src/lib.rs', import.meta.url)), await readFile(new URL('../public/rust-never-sample/source.rs', import.meta.url)));
});
