import { WASM_MODULE_REGISTRY, type WasmModuleInfo } from '../data/wasmModuleRegistry';

export type WasmModuleStartupRow = {
  module_id: string;
  enabled: number;
  updated_at: string;
  updated_by: string | null;
};

export type WasmModuleListItem = WasmModuleInfo & {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

/**
 * レジストリ(コード側の静的カタログ)とD1の起動時設定行をマージする。
 * D1に行が無いモジュールはデフォルトで有効(enabled: true)として扱う
 * (未設定=無効ではなく「まだ誰も変更していない」を意味するため)。
 */
export function mergeWasmModuleConfig(rows: WasmModuleStartupRow[]): WasmModuleListItem[] {
  const rowMap = new Map(rows.map((r) => [r.module_id, r]));
  return WASM_MODULE_REGISTRY.map((mod) => {
    const row = rowMap.get(mod.id);
    return {
      ...mod,
      enabled: row ? row.enabled !== 0 : true,
      updatedAt: row?.updated_at ?? null,
      updatedBy: row?.updated_by ?? null,
    };
  });
}

/**
 * moduleIdがレジストリに存在しない値でも無条件でD1に書き込んでしまわない
 * ようにするための検証。未登録IDはエラーにする(サイレントに握りつぶさない)。
 */
export function isKnownWasmModuleId(moduleId: string): boolean {
  return WASM_MODULE_REGISTRY.some((m) => m.id === moduleId);
}

/**
 * D1に行が無い(=誰も変更していない)場合はデフォルト有効として扱う。
 * /neko 256 等、モジュール単体の有効判定に使う。
 */
export function isWasmModuleEnabled(row: WasmModuleStartupRow | null): boolean {
  return row ? row.enabled !== 0 : true;
}
