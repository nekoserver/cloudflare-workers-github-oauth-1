/* tslint:disable */
/* eslint-disable */

/** GitHub Trees API由来のTSVをMarkdownの入れ子リストへ整形します。 */
export function tree_format(entries: string, root_label: string, max_depth: number, show_hidden: boolean): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
export type SyncInitInput = BufferSource | WebAssembly.Module;
export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly tree_format: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
}
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;
export default function __wbg_init(module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
