import { initSync, tree_format } from '../../public/wasm/tree.js';
import treeWasmModule from '../../public/wasm/tree_bg.wasm';

let initialized = false;

function ensureInit(): void {
  if (!initialized) {
    initSync(treeWasmModule);
    initialized = true;
  }
}

/** GitHub Trees API由来のTSVをtree-wasmでMarkdownの入れ子リストにする。 */
export function formatTreeViaWasm(entries: string, rootLabel: string, maxDepth: number, showHidden: boolean): string {
  ensureInit();
  return tree_format(entries, rootLabel, maxDepth, showHidden);
}
