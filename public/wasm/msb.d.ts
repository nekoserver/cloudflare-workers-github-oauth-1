/* tslint:disable */
/* eslint-disable */

/**
 * `msb <command> --help` 相当。該当コマンドが無ければエラーを返す。
 */
export function msb_command_help(name: string): string;

/**
 * `msb --help` 相当のフラットな一覧をMarkdownで返す。
 * `query` が空でなければコマンドパス・説明を部分一致(大小無視)でフィルタする。
 */
export function msb_help(query: string): string;

/**
 * `msb --tree` 相当のコマンド階層をMarkdownの入れ子リストで返す。
 */
export function msb_tree(query: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly msb_command_help: (a: number, b: number) => [number, number, number, number];
    readonly msb_help: (a: number, b: number) => [number, number];
    readonly msb_tree: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
