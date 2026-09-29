import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findWasmModule, WASM_MODULE_REGISTRY } from './data/wasmModuleRegistry';
import { isKnownWasmModuleId, mergeWasmModuleConfig } from './utils/wasmModuleConfig';

describe('wranglerが利用するWASMのモジュール一覧への登録', () => {
  it('wranglerの直接依存blake3-wasmと実ファイルを指す', () => {
    const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
      packages: Record<string, { dependencies?: Record<string, string> }>;
    };
    const wrangler = findWasmModule('wrangler');

    expect(packageLock.packages['node_modules/wrangler'].dependencies?.['blake3-wasm']).toBe('2.1.5');
    expect(wrangler).toMatchObject({
      id: 'wrangler',
      wasmPath: 'node_modules/blake3-wasm/dist/wasm/web/blake3_js_bg.wasm',
      sourceFile: 'package-lock.json',
      sizeBytes: 34384,
    });
    expect(statSync(wrangler!.wasmPath).size).toBe(wrangler!.sizeBytes);
    expect(WASM_MODULE_REGISTRY.filter((module) => module.id === 'wrangler')).toHaveLength(1);
  });

  it('D1に設定行がなくても一覧へ有効状態で含める', () => {
    expect(isKnownWasmModuleId('wrangler')).toBe(true);
    expect(mergeWasmModuleConfig([]).find((module) => module.id === 'wrangler')).toMatchObject({
      enabled: true,
      updatedAt: null,
      updatedBy: null,
    });
  });
});
