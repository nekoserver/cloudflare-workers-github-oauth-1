import { describe, it, expect } from 'vitest';
import { mergeWasmModuleConfig, isKnownWasmModuleId, isWasmModuleEnabled, type WasmModuleStartupRow } from './wasmModuleConfig';
import { WASM_MODULE_REGISTRY } from '../data/wasmModuleRegistry';

// 対象: /wasm-modulesページ・/api/wasm-modulesが使う純粋関数。
// レジストリ(コード側の静的カタログ)とD1の起動時設定行(wasm_module_startup_config)を
// マージし、D1に行が無いモジュールはデフォルト有効として扱う。
//
// 故障シナリオ:
//   (1) D1に行が無いモジュールをデフォルト無効(enabled:false)にしてしまい、
//       誰も設定を変更していないのに/neko 256が使えなくなる
//   (2) enabled=0の行があるのにenabled:trueとして返してしまう(数値0のfalsy判定漏れ)
//   (3) レジストリに存在しないmoduleIdでもD1書き込みを許可してしまう

describe('mergeWasmModuleConfig', () => {
  it('D1に行が無いモジュールはデフォルトで有効(enabled: true)として返す', () => {
    const result = mergeWasmModuleConfig([]);
    expect(result.length).toBe(WASM_MODULE_REGISTRY.length);
    expect(result.every((m) => m.enabled === true)).toBe(true);
    expect(result.every((m) => m.updatedAt === null)).toBe(true);
  });

  it('D1にenabled=0の行があるモジュールはenabled: falseとして返す', () => {
    const rows: WasmModuleStartupRow[] = [
      { module_id: 'sha256', enabled: 0, updated_at: '2026-08-18 00:00:00', updated_by: 'tester' },
    ];
    const result = mergeWasmModuleConfig(rows);
    const sha256 = result.find((m) => m.id === 'sha256');
    expect(sha256?.enabled).toBe(false);
    expect(sha256?.updatedAt).toBe('2026-08-18 00:00:00');
    expect(sha256?.updatedBy).toBe('tester');
  });

  it('D1にenabled=1の行があるモジュールはenabled: trueとして返す', () => {
    const rows: WasmModuleStartupRow[] = [
      { module_id: 'sha256', enabled: 1, updated_at: '2026-08-18 00:00:00', updated_by: 'tester' },
    ];
    const result = mergeWasmModuleConfig(rows);
    expect(result.find((m) => m.id === 'sha256')?.enabled).toBe(true);
  });

  it('レジストリに無いmodule_idの行は無視する(レジストリ側にだけ存在する項目のみ返す)', () => {
    const rows: WasmModuleStartupRow[] = [
      { module_id: 'unknown-module', enabled: 0, updated_at: '2026-08-18 00:00:00', updated_by: null },
    ];
    const result = mergeWasmModuleConfig(rows);
    expect(result.find((m) => m.id === 'unknown-module')).toBeUndefined();
  });
});

describe('isKnownWasmModuleId', () => {
  it('レジストリに存在するIDはtrue', () => {
    expect(isKnownWasmModuleId('sha256')).toBe(true);
  });

  it('レジストリに存在しないIDはfalse(未知のIDでD1書き込みを許可しない)', () => {
    expect(isKnownWasmModuleId('unknown-module')).toBe(false);
    expect(isKnownWasmModuleId('')).toBe(false);
  });
});

describe('isWasmModuleEnabled', () => {
  it('行が無い(null)場合はデフォルト有効', () => {
    expect(isWasmModuleEnabled(null)).toBe(true);
  });

  it('enabled=0の行は無効', () => {
    expect(isWasmModuleEnabled({ module_id: 'sha256', enabled: 0, updated_at: '', updated_by: null })).toBe(false);
  });

  it('enabled=1の行は有効', () => {
    expect(isWasmModuleEnabled({ module_id: 'sha256', enabled: 1, updated_at: '', updated_by: null })).toBe(true);
  });
});
