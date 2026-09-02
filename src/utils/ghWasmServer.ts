import { initSync, validate_repo, format_pr_list } from '../../public/wasm/gh.js';
import ghWasmModule from '../../public/wasm/gh_bg.wasm';

let initialized = false;

function ensureInit(): void {
  if (!initialized) {
    initSync(ghWasmModule);
    initialized = true;
  }
}

/**
 * /neko gh pr list・/api/gh/pr-list 用。gh-wasm(Rust実装)の validate_repo を
 * Cloudflare Workers上でも直接実行する(sha256WasmServer.tsと同じinitSync方式)。
 *
 * このファイルはindex.ts側からdynamic import()でのみ読み込むこと。
 * 静的importにすると `.wasm` インポートがVite/vitestの環境では
 * WebAssembly.Moduleではなくアセットパス文字列を返すため、このファイルを
 * importするだけで既存のindex.tsを読み込む全テスト(`import app from
 * './index'`)がテスト収集時に壊れる。
 */
export function validateRepoViaWasm(value: string): string {
  ensureInit();
  return validate_repo(value);
}

/**
 * GitHub REST API `GET /repos/{owner}/{repo}/pulls` の生JSONレスポンス(文字列)を
 * gh-wasmでMarkdownテーブルへ整形する。実際のfetch(OAuthトークン付与含む)は
 * 呼び出し元(index.ts)が行い、この関数は整形のみを担う。maskAuthorは
 * 設定ページの「スラッシュコマンドからのプルリク応答で作成者を伏せる」
 * トグル(Cookie: neko_pr_hide_author、デフォルトON)の値をそのまま渡す。
 */
export function formatPrListViaWasm(repoFullName: string, json: string, maskAuthor: boolean): string {
  ensureInit();
  return format_pr_list(repoFullName, json, maskAuthor);
}
