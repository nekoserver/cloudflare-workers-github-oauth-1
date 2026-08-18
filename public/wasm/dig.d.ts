/* tslint:disable */
/* eslint-disable */

/**
 * 問い合わせ対象のドメイン名・レコードタイプから、DNSワイヤーフォーマットの
 * 問い合わせパケットを組み立てる(ヘッダ12バイト + Question section)。
 * IDは固定値(0x1234)を使う(乱数生成にwasm32側の追加依存を増やしたくないため。
 * UDPと異なりDNS over HTTPSはHTTPS自体がトランスポートの完全性を保証するので
 * キャッシュポイズニング対策としてのID/ソースポートのランダム化は本質的でない)。
 */
export function dig_build_query(name: string, qtype: string): Uint8Array;

/**
 * dig(1)風のテキスト出力を組み立てる。実際の名前解決(DNS over HTTPS経由の
 * fetch)はWorker側(TypeScript)が担当し、この関数はビルド済みの問い合わせと
 * 生の応答バイト列を受け取ってワイヤーフォーマットの解析・整形のみを行う。
 */
export function dig_format_response(name: string, qtype: string, server: string, query_ms: number, response_bytes: Uint8Array): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly dig_build_query: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly dig_format_response: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number, number];
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
