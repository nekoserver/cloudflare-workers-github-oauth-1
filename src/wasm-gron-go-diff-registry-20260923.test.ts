import { describe, expect, it } from 'vitest';
import { WASM_MODULE_REGISTRY, findWasmModule } from './data/wasmModuleRegistry';
import { isKnownWasmModuleId, mergeWasmModuleConfig } from './utils/wasmModuleConfig';

// 対象: gron-wasm(gronのJSON⇔代入文変換)・go-diff-wasm(go-diffの行単位テキスト
// 差分)のWASM_MODULE_REGISTRYへの登録。どちらもGo/js-wasm移植(gh-attach-wasm・
// sqlc-wasmと同じパターン)で、ブラウザページ(/gron-wasm・/go-diff-wasm)からのみ呼ばれる。
describe('gron-wasm / go-diff-wasm のWASMモジュール一覧への登録', () => {
  it('gronのソース情報を取得できる', () => {
    expect(findWasmModule('gron')).toMatchObject({
      id: 'gron',
      sourceDir: 'wasm/gron-wasm',
      sourceFile: 'wasm/gron-wasm/gron.go',
      wasmPath: 'public/wasm/gron.wasm',
    });
    expect(WASM_MODULE_REGISTRY.filter((module) => module.id === 'gron')).toHaveLength(1);
  });

  it('go-diffのソース情報を取得できる', () => {
    expect(findWasmModule('go-diff')).toMatchObject({
      id: 'go-diff',
      sourceDir: 'wasm/go-diff-wasm',
      sourceFile: 'wasm/go-diff-wasm/diff.go',
      wasmPath: 'public/wasm/go-diff.wasm',
    });
    expect(WASM_MODULE_REGISTRY.filter((module) => module.id === 'go-diff')).toHaveLength(1);
  });

  it('D1に設定行がなくても一覧へ有効状態で含める', () => {
    expect(isKnownWasmModuleId('gron')).toBe(true);
    expect(isKnownWasmModuleId('go-diff')).toBe(true);
    const merged = mergeWasmModuleConfig([]);
    expect(merged.find((module) => module.id === 'gron')).toMatchObject({
      enabled: true,
      updatedAt: null,
      updatedBy: null,
    });
    expect(merged.find((module) => module.id === 'go-diff')).toMatchObject({
      enabled: true,
      updatedAt: null,
      updatedBy: null,
    });
  });
});
