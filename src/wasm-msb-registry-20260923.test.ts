import { describe, expect, it } from 'vitest';
import { WASM_MODULE_REGISTRY, findWasmModule } from './data/wasmModuleRegistry';
import { isKnownWasmModuleId, mergeWasmModuleConfig } from './utils/wasmModuleConfig';

// 対象: msb-wasm(microsandboxのCLI `msb` のヘルプ・ツリー表示のみを再実装したWASMモジュール)の
// WASM_MODULE_REGISTRYへの登録。msb本体はKVM/libkrun等のOS仮想化に依存しWASM化できないため、
// このモジュールはヘルプ出力のみを提供する(実サンドボックス起動は対象外)。
describe('msb-wasmのWASMモジュール一覧への登録', () => {
  it('レジストリからソース情報を取得できる', () => {
    const msb = findWasmModule('msb');

    expect(msb).toMatchObject({
      id: 'msb',
      sourceDir: 'wasm/msb-wasm',
      sourceFile: 'wasm/msb-wasm/src/lib.rs',
      wasmPath: 'public/wasm/msb_bg.wasm',
    });
    expect(WASM_MODULE_REGISTRY.filter((module) => module.id === 'msb')).toHaveLength(1);
  });

  it('D1に設定行がなくても一覧へ有効状態で含める', () => {
    expect(isKnownWasmModuleId('msb')).toBe(true);
    expect(mergeWasmModuleConfig([]).find((module) => module.id === 'msb')).toMatchObject({
      enabled: true,
      updatedAt: null,
      updatedBy: null,
    });
  });
});
