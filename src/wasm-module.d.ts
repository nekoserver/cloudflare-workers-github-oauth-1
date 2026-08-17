/**
 * Cloudflare Workers/wranglerは .wasm ファイルを直接ESモジュールとして
 * importでき、その場合デフォルトエクスポートは WebAssembly.Module になる
 * (fetchやWebAssembly.instantiateStreamingを介さない)。
 */
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
