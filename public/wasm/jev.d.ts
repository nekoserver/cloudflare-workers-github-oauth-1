/* tslint:disable */
/* eslint-disable */

export function build_jev_request_body(state: string, labels_json: string): string;

export function compute_jev_evaluation_plan(all_labels_json: string, evaluated_rows_json: string): string;

export function parse_jev_api_response(labels_json: string, response_json: string): string;

export function parse_label_criteria(options_json?: string | null): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly build_jev_request_body: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly compute_jev_evaluation_plan: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly parse_jev_api_response: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly parse_label_criteria: (a: number, b: number) => any;
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
