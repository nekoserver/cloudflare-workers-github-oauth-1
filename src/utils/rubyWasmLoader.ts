/**
 * /ruby-wasm と /kimi-code/markdown/:id が共有する、公式 CRuby WASM の
 * ブラウザ読み込みヘルパ。
 *
 * 4.0 の ruby+stdlib.wasm は非圧縮で約32MBある。WebAssembly.compileStreaming
 * は Content-Type が application/wasm でも、gzip 展開と巨大バイナリの組み合わせで
 * iOS Safari がハング・失敗することがある。常に本文を ArrayBuffer にしてから
 * WebAssembly.compile する。ダウンロード中は受信量をステータスに出し、
 * Cache API に載せられれば2回目以降はネットワークを避ける。
 */

export function formatRubyWasmDownloadStatus(received: number, total: number): string {
  const recvMb = (received / 1048576).toFixed(1);
  if (total > 0 && received <= total) {
    const pct = Math.min(100, Math.floor((received / total) * 100));
    const totalMb = (total / 1048576).toFixed(1);
    return 'WASMバイナリを読み込み中… ' + recvMb + ' / ' + totalMb + ' MB (' + pct + '%)';
  }
  return 'WASMバイナリを読み込み中… ' + recvMb + ' MB';
}

export function concatUint8Chunks(chunks: Uint8Array[]): ArrayBuffer {
  let total = 0;
  for (let i = 0; i < chunks.length; i++) total += chunks[i].byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    out.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return out.buffer;
}

export function rubyWasmBinaryCacheName(rubyBuildLine: string, packageVersion: string): string {
  return 'ruby-wasm-binary-' + rubyBuildLine + '-' + packageVersion;
}

/**
 * WASM 上で eval した RUBY_VERSION (例: 4.0.0) が、読み込み先パッケージの
 * ビルドライン (例: 4.0) で始まっていることを確認する。
 * 3.4 バイナリが残ったまま「4.0 に切り替えた」と誤認するのを防ぐ。
 */
export function assertRubyBuildLine(actualVersion: string, expectedBuildLine: string): void {
  if (!actualVersion || actualVersion.indexOf(expectedBuildLine) !== 0) {
    throw new Error(
      '期待したRuby ' + expectedBuildLine + ' ではなく ' + (actualVersion || '(空)') + ' が起動しました'
    );
  }
}

/**
 * compileStreaming は使わない。MIME が application/wasm 以外でも、
 * バイト列が WASM なら compile できる。
 */
export async function compileRubyWasmFromResponse(res: Response): Promise<WebAssembly.Module> {
  if (!res.ok) {
    throw new Error('Rubyバイナリの取得に失敗しました: HTTP ' + res.status);
  }
  const bytes = await res.arrayBuffer();
  return WebAssembly.compile(bytes);
}

/**
 * <script type="module"> に埋め込むブラウザ側ローダー。
 * TypeScript の template literal 内へ入れるため、JS 文字列に \' \" 単独 \\n、
 * バックスラッシュ付き regex を書かない。
 */
export function getRubyWasmLoaderScript(): string {
  return `
    function formatRubyWasmDownloadStatus(received, total) {
      var recvMb = (received / 1048576).toFixed(1);
      if (total > 0 && received <= total) {
        var pct = Math.min(100, Math.floor((received / total) * 100));
        var totalMb = (total / 1048576).toFixed(1);
        return 'WASMバイナリを読み込み中… ' + recvMb + ' / ' + totalMb + ' MB (' + pct + '%)';
      }
      return 'WASMバイナリを読み込み中… ' + recvMb + ' MB';
    }

    function concatUint8Chunks(chunks) {
      var total = 0;
      var i;
      for (i = 0; i < chunks.length; i++) total += chunks[i].byteLength;
      var out = new Uint8Array(total);
      var offset = 0;
      for (i = 0; i < chunks.length; i++) {
        out.set(chunks[i], offset);
        offset += chunks[i].byteLength;
      }
      return out.buffer;
    }

    function readResponseBodyWithProgress(res, onProgress) {
      var total = Number(res.headers.get('Content-Length') || '0');
      if (!res.body || typeof res.body.getReader !== 'function') {
        return res.arrayBuffer().then(function(buf) {
          if (onProgress) onProgress(buf.byteLength, total || buf.byteLength);
          return buf;
        });
      }
      var reader = res.body.getReader();
      var chunks = [];
      var received = 0;
      function pump() {
        return reader.read().then(function(result) {
          if (result.done) return concatUint8Chunks(chunks);
          chunks.push(result.value);
          received += result.value.byteLength;
          if (onProgress) onProgress(received, total);
          return pump();
        });
      }
      return pump();
    }

    var rubyWasmCachePutError = null;

    function openRubyWasmCache(cacheName) {
      if (typeof caches === 'undefined' || !caches.open) return Promise.resolve(null);
      return caches.open(cacheName).then(function(cache) {
        return cache;
      }).catch(function(err) {
        rubyWasmCachePutError = err && err.message ? err.message : String(err);
        return null;
      });
    }

    function fetchRubyWasmBytes(binaryUrl, cacheName, onProgress) {
      return openRubyWasmCache(cacheName).then(function(cache) {
        var lookup = cache
          ? cache.match(binaryUrl).catch(function(err) {
              rubyWasmCachePutError = err && err.message ? err.message : String(err);
              return null;
            })
          : Promise.resolve(null);
        return lookup.then(function(hit) {
          if (hit) {
            if (onProgress) onProgress(-1, -1);
            return hit.arrayBuffer();
          }
          return fetch(binaryUrl).then(function(res) {
            if (!res.ok) throw new Error('Rubyバイナリの取得に失敗しました: HTTP ' + res.status);
            return readResponseBodyWithProgress(res, onProgress).then(function(buf) {
              if (cache) {
                Promise.resolve(cache.put(binaryUrl, new Response(buf.slice(0), {
                  headers: { 'Content-Type': 'application/wasm' }
                }))).catch(function(err) {
                  rubyWasmCachePutError = err && err.message ? err.message : String(err);
                });
              }
              return buf;
            });
          });
        });
      });
    }

    function loadRubyWasmVm(jsUrl, binaryUrl, cacheName, hooks) {
      hooks = hooks || {};
      if (hooks.onStatus) hooks.onStatus('グルーコードを読み込み中…');
      return import(jsUrl).then(function(mod) {
        if (hooks.onStatus) hooks.onStatus('WASMバイナリを読み込み中…');
        return fetchRubyWasmBytes(binaryUrl, cacheName, function(received, total) {
          if (!hooks.onStatus) return;
          if (received < 0) {
            hooks.onStatus('キャッシュからWASMバイナリを読み込みました');
            return;
          }
          hooks.onStatus(formatRubyWasmDownloadStatus(received, total));
        }).then(function(bytes) {
          if (hooks.onStatus) hooks.onStatus('WASMモジュールをコンパイル中…');
          return WebAssembly.compile(bytes).then(function(compiled) {
            if (hooks.onStatus) hooks.onStatus('Ruby VM を初期化中…');
            return mod.DefaultRubyVM(compiled, { consolePrint: false });
          });
        });
      }).then(function(result) {
        var ver = '';
        try {
          ver = result.vm.eval('RUBY_VERSION').toString();
        } catch (verErr) {
          throw new Error('RUBY_VERSION の取得に失敗しました: ' + (verErr && verErr.message ? verErr.message : String(verErr)));
        }
        if (hooks.expectedBuildLine && ver.indexOf(hooks.expectedBuildLine) !== 0) {
          throw new Error('期待したRuby ' + hooks.expectedBuildLine + ' ではなく ' + (ver || '(空)') + ' が起動しました');
        }
        if (hooks.onReady) hooks.onReady(result.vm, ver);
        return result.vm;
      }).catch(function(err) {
        if (hooks.onError) hooks.onError(err);
        else throw err;
      });
    }
  `;
}
