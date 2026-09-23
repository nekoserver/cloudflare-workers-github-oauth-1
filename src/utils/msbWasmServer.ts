import { initSync, msb_help } from '../../public/wasm/msb.js';
import msbWasmModule from '../../public/wasm/msb_bg.wasm';

let initialized = false;

function ensureInit(): void {
  if (!initialized) {
    initSync(msbWasmModule);
    initialized = true;
  }
}

/**
 * `/neko msb --help` 用。microsandbox(https://github.com/microsandbox/microsandbox)の
 * CLI `msb` のヘルプ一覧(msb-wasm・Rust実装)をMarkdownで返す。msb本体は
 * KVM/libkrun等のOS仮想化に依存するmicroVMランタイムでWASM(Workers)からは
 * 実行できないため、公式README由来の静的なヘルプ出力のみを提供する。
 *
 * このファイルはindex.ts側からdynamic import()でのみ読み込むこと
 * (理由はsha256WasmServer.tsのコメントを参照。.wasm静的importを含む
 * ファイルをindex.tsが静的importすると、`import app from './index'`を
 * 使う既存の全テストがテスト収集時に壊れる)。
 */
export function msbHelpViaWasm(query: string): string {
  ensureInit();
  return msb_help(query);
}
