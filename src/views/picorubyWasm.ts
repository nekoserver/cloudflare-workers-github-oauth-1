import { getThemeCSS, getThemeInitScript, getThemeToggleCSS, getThemeToggleHTML, getThemeToggleScript } from '../utils/theme';

export const PICORUBY_WASM_IRB_URL = 'https://picoruby.github.io/wasm/';
export const PICORUBY_WASM_IRB_PROXY_PATH = '/picoruby-wasm/irb/';

/**
 * The upstream IRB uses window.prompt() for input. Current browsers suppress
 * JavaScript dialogs in a cross-origin iframe, even when allow-modals is set.
 * Serving the document as our top-level response avoids that restriction. A
 * base element keeps relative JS/WASM asset URLs on the official distribution.
 */
export function preparePicorubyIrbHtml(html: string): string {
  const base = `<base href="${PICORUBY_WASM_IRB_URL}">`;
  // GitHub Pages projects commonly emit root-relative URLs (for example,
  // `/wasm/index.js`). A <base> element does not affect those URLs, so without
  // this rewrite the proxied document asks this Worker for its unrelated
  // `/wasm/*` static files instead of the official distribution, and PicoRuby
  // never reaches the first prompt.
  const withUpstreamAssetUrls = html
    .replace(/(["'`])\/wasm\//g, `$1${PICORUBY_WASM_IRB_URL}`)
    .replace(/(\b(?:src|href)\s*=\s*)\/wasm\//gi, `$1${PICORUBY_WASM_IRB_URL}`)
    .replace(/(url\(\s*)\/wasm\//gi, `$1${PICORUBY_WASM_IRB_URL}`);
  if (/<head(?:\s[^>]*)?>/i.test(html)) {
    return withUpstreamAssetUrls.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${base}`);
  }
  return `${base}${withUpstreamAssetUrls}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** PicoRuby公式WASM版IRBを、このアプリのテーマ付きシェル内に表示する。 */
export function getPicorubyWasmPage(username: string): string {
  const safeUsername = escapeHtml(username);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0d1117">
  <title>PicoRuby / WASM IRB</title>
  ${getThemeInitScript()}
  <style>
    ${getThemeCSS()}
    ${getThemeToggleCSS()}
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      min-height: 100dvh; color: var(--text-primary);
      background: linear-gradient(135deg, var(--bg-gradient-start), var(--bg-gradient-end));
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .navbar {
      position: sticky; top: 0; z-index: 10; height: 44px; padding: 0 16px;
      display: flex; align-items: center; justify-content: space-between;
      background: var(--navbar-bg); border-bottom: 1px solid var(--border-color);
      box-shadow: 0 2px 10px var(--navbar-shadow); backdrop-filter: blur(10px);
    }
    .brand { display: flex; align-items: center; gap: 9px; font-weight: 800; }
    .brand-mark { color: var(--accent-color); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .user-tools { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 12px; }
    main { width: min(1120px, calc(100% - 24px)); margin: 20px auto; }
    .intro {
      margin-bottom: 14px; padding: 18px 20px; border: 1px solid var(--border-color);
      border-radius: 14px; background: var(--card-bg); box-shadow: 0 10px 30px var(--card-shadow-light);
    }
    h1 { margin: 0 0 7px; font-size: clamp(20px, 4vw, 30px); }
    .intro p { margin: 0; color: var(--text-secondary); line-height: 1.65; }
    .hint { margin-top: 9px; font-size: 13px; color: var(--text-muted); }
    .terminal-card {
      position: relative; overflow: hidden; min-height: 640px; height: calc(100dvh - 190px);
      border: 1px solid var(--border-color); border-radius: 14px; background: var(--code-bg);
      box-shadow: 0 16px 40px var(--card-shadow);
    }
    .terminal-bar {
      height: 38px; padding: 0 14px; display: flex; align-items: center; gap: 7px;
      background: var(--bg-secondary); border-bottom: 1px solid var(--border-color);
      color: var(--text-secondary); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border-color); }
    .terminal-title { margin-left: 5px; }
    iframe { display: block; width: 100%; height: calc(100% - 38px); border: 0; background: var(--code-bg); }
    .loading {
      position: absolute; inset: 38px 0 0; display: grid; place-items: center;
      padding: 24px; background: var(--code-bg); color: var(--text-secondary); text-align: center;
    }
    .loading[hidden] { display: none; }
    .spinner {
      width: 30px; height: 30px; margin: 0 auto 12px; border: 3px solid var(--border-color);
      border-top-color: var(--accent-color); border-radius: 50%; animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 640px) {
      .username { display: none; }
      main { width: calc(100% - 12px); margin: 8px auto; }
      .intro { padding: 14px; border-radius: 10px; }
      .terminal-card { height: calc(100dvh - 188px); min-height: 500px; border-radius: 10px; }
    }
    @media (display-mode: standalone) { .username { display: none; } }
  </style>
</head>
<body>
  <nav class="navbar" aria-label="ページヘッダー">
    <div class="brand"><span class="brand-mark">&gt;_</span><span>PicoRuby / WASM</span></div>
    <div class="user-tools">${getThemeToggleHTML()}<span class="username">${safeUsername}</span></div>
  </nav>
  <main>
    <section class="intro" aria-labelledby="pageTitle">
      <h1 id="pageTitle">ブラウザで PicoRuby IRB</h1>
      <p>PicoRuby の WebAssembly ランタイムを読み込み、インタラクティブな Ruby をこのページで実行できます。</p>
      <p class="hint">プロンプトが表示されたら Ruby の式を入力して Enter を押してください。初回の読み込みには少し時間がかかることがあります。</p>
    </section>
    <section class="terminal-card" aria-label="PicoRuby IRB">
      <div class="terminal-bar" aria-hidden="true"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="terminal-title">picoruby.wasm — irb</span></div>
      <div class="loading" id="loadingStatus" role="status"><div><div class="spinner"></div>PicoRuby IRB を読み込んでいます…</div></div>
      <!-- 公式IRBはwindow.prompt()を使うため、ブラウザーがダイアログを拒否しないようHTMLだけを同一オリジン経由で表示する。 -->
      <iframe id="picorubyIrb" title="PicoRuby WebAssembly IRB" src="${PICORUBY_WASM_IRB_PROXY_PATH}" referrerpolicy="no-referrer" allow="clipboard-read; clipboard-write"></iframe>
    </section>
  </main>
  <script>
    ${getThemeToggleScript()}
    (function () {
      var frame = document.getElementById('picorubyIrb');
      var loading = document.getElementById('loadingStatus');
      frame.addEventListener('load', function () { loading.hidden = true; });
    })();
  </script>
</body>
</html>`;
}
