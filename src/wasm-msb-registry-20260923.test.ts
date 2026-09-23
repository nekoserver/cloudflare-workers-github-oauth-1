import { describe, expect, it } from 'vitest';
import { findWasmModule } from './data/wasmModuleRegistry';

describe('msb-wasm の WASM モジュール一覧への登録', () => {
  it('移植範囲とソースを公開する', () => {
    expect(findWasmModule('msb')).toEqual({
      id: 'msb',
      name: 'msb (microsandbox CLI, Rust)',
      description:
        'microsandbox の msb CLI 引数を解析し、サンドボックス操作の実行要求を JSON へ変換する。microVM 起動・デーモン通信・ファイル I/O はホスト側が担当する',
      wasmPath: 'wasm/msb-wasm/target/wasm32-unknown-unknown/release/msb_wasm.wasm',
      sourceDir: 'wasm/msb-wasm',
      sourceFile: 'wasm/msb-wasm/src/lib.rs',
      approxSize: '未ビルド',
      sizeBytes: 0,
      builtAt: '未ビルド',
    });
  });
});
