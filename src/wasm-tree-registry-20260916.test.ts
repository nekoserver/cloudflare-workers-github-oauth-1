import { describe, expect, it } from 'vitest';
import { WASM_MODULE_REGISTRY, findWasmModule } from './data/wasmModuleRegistry';
import { isKnownWasmModuleId, mergeWasmModuleConfig } from './utils/wasmModuleConfig';

describe('tree-wasmのWASMモジュール一覧への登録', () => {
  it('レジストリからソース情報を取得できる', () => {
    const tree = findWasmModule('tree');

    expect(tree).toMatchObject({
      id: 'tree',
      sourceDir: 'wasm/tree-wasm',
      sourceFile: 'wasm/tree-wasm/src/lib.rs',
      approxSize: '未ビルド',
      sizeBytes: 0,
      builtAt: '未ビルド',
    });
    expect(WASM_MODULE_REGISTRY.filter((module) => module.id === 'tree')).toHaveLength(1);
  });

  it('D1に設定行がなくても一覧へ有効状態で含める', () => {
    expect(isKnownWasmModuleId('tree')).toBe(true);
    expect(mergeWasmModuleConfig([]).find((module) => module.id === 'tree')).toMatchObject({
      enabled: true,
      updatedAt: null,
      updatedBy: null,
    });
  });
});
