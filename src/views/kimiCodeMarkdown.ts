import { escapeHtml } from '../utils/html';
import { splitMarkdownCodeBlocks, isRunnableRubyCodeBlock, type MarkdownCodeBlockSegment } from '../utils/markdownCodeBlocks';
import { getMarkdownParserScript, getMarkdownPreviewCSS } from '../utils/markdownRenderer';
import { RUBY_WASM_JS_URL, RUBY_WASM_BINARY_URL } from './rubyWasm';

const SHARED_STYLE = `
:root {
  color-scheme: light dark;
  --bg:          light-dark(#f6f8fa, #0d1117);
  --panel:       light-dark(#ffffff, #161b22);
  --border:      light-dark(#d0d7de, #30363d);
  --text:        light-dark(#1f2328, #c9d1d9);
  --text-muted:  light-dark(#636c76, #8b949e);
  --text-strong: light-dark(#1f2328, #f0f6fc);
  --accent:      light-dark(#0969da, #58a6ff);
  --accent-fg:   light-dark(#ffffff, #0d1117);
  --input-bg:    light-dark(#ffffff, #0d1117);
  --danger:      light-dark(#cf222e, #f85149);
  --text-primary: var(--text);
  --text-muted:  light-dark(#636c76, #8b949e);
  --border-color: var(--border);
  --accent-color: var(--accent);
  --code-bg:     var(--bg);
  --bg-secondary: var(--bg);
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 24px;
  background: var(--bg); color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px; line-height: 1.6;
  max-width: 900px; margin-left: auto; margin-right: auto;
}
h1 { color: var(--text-strong); font-size: 20px; margin: 0 0 4px; }
a { color: var(--accent); }
.subtitle { color: var(--text-muted); font-size: 12px; margin-bottom: 16px; }
.panel {
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 14px 16px; margin-bottom: 14px;
}
.panel-label { font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 8px; }
.btn {
  background: var(--accent); border: 1px solid var(--accent); border-radius: 6px;
  color: var(--accent-fg); font-size: 13px; padding: 7px 16px; cursor: pointer;
  font-weight: 600; text-decoration: none; display: inline-block;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn.sm { font-size: 11px; padding: 4px 10px; font-weight: normal; background: var(--panel); color: var(--text); border-color: var(--border); }
${getMarkdownPreviewCSS()}
`;

/**
 * Markdownのテキスト部分(コードブロック以外)を描画する領域。パース処理は
 * クライアント側で共有パーサ(parseMd, getMarkdownParserScript())を使って
 * 行うため、ここでは生のMarkdownを`<script type="application/json">`に
 * JSON.stringifyして埋め込むだけにする(escapeHtmlした文字列をそのまま
 * innerHTMLに入れると見出しや強調等が解釈されないため)。
 */
function renderTextBlock(content: string, index: number): string {
  const jsonPayload = JSON.stringify({ markdown: content }).replace(/<\//g, '<\\/');
  return `<div class="panel">
  <div class="preview-area" data-md-text="${index}"></div>
  <script type="application/json" data-md-text-source="${index}">${jsonPayload}</script>
</div>`;
}

function listItemLabel(title: string, createdAt: string): string {
  return `${escapeHtml(title)} <span style="color:var(--text-muted);font-weight:normal;">(${escapeHtml(createdAt)})</span>`;
}

export function getKimiCodeMarkdownListPage(
  username: string,
  rows: { id: string; title: string; created_at: string }[]
): string {
  const safeUser = escapeHtml(username);
  const items = rows.length
    ? `<ul style="list-style:none;padding:0;margin:0;">${rows
        .map((r) => `<li style="padding:8px 0;border-bottom:1px solid var(--border);"><a href="/kimi-code/markdown/${encodeURIComponent(r.id)}">${listItemLabel(r.title, r.created_at)}</a></li>`)
        .join('')}</ul>`
    : `<p style="color:var(--text-muted);">まだ保存されたMarkdownはありません。<a href="/kimi-code">/kimi-code</a>で生成後「📝 Markdownとして保存」を押してください。</p>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>保存したMarkdown一覧 - Kimi K2.7 Code</title>
<style>${SHARED_STYLE}</style>
</head>
<body>
<h1>📚 保存したMarkdown一覧</h1>
<p class="subtitle"><a href="/kimi-code">← /kimi-code に戻る</a> <span style="color:var(--text-muted);">${safeUser}</span></p>
<div class="panel">${items}</div>
</body>
</html>`;
}

/** 実行不可(Ruby以外)のコードブロックを<pre><code>で描画する。dangerouslySetInnerHTML相当の操作は行わず、必ずescapeHtml()した文字列だけを埋め込む。 */
function renderStaticCodeBlock(segment: MarkdownCodeBlockSegment & { type: 'code' }): string {
  const langLabel = segment.lang ? escapeHtml(segment.lang) : 'text';
  return `<div class="panel">
  <div class="panel-label">\`\`\`${langLabel}</div>
  <pre style="margin:0;overflow-x:auto;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12.5px;"><code>${escapeHtml(segment.content)}</code></pre>
</div>`;
}

/**
 * Ruby/WASMで実行可能なコードブロックを描画する。コード本文はHTMLに直接
 * 埋め込まず(バッククォート・`</script>`等を含むとテンプレートが壊れる
 * リスクがあるため)、`<script type="application/json">`にJSON.stringify
 * した文字列として埋め込み、実行時にJSONとして読み出す。
 */
function renderRunnableRubyBlock(segment: MarkdownCodeBlockSegment & { type: 'code' }, index: number): string {
  // </script> によるタグの早期終了を防ぐため、"</" を "<\/" にエスケープする
  // (JSON文字列の中身としては同じ文字列を表すため、パース結果には影響しない)。
  const jsonPayload = JSON.stringify({ code: segment.content }).replace(/<\//g, '<\\/');
  return `<div class="panel" data-ruby-block="${index}">
  <div class="panel-label">
    💎 Ruby(WASM)で実行可能
    <button class="btn sm" type="button" data-run-ruby-block="${index}" disabled>▶ 実行(WASM読み込み中…)</button>
  </div>
  <pre style="margin:0 0 8px;overflow-x:auto;white-space:pre;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12.5px;"><code>${escapeHtml(segment.content)}</code></pre>
  <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12.5px;white-space:pre-wrap;word-break:break-all;" data-ruby-result="${index}"></div>
  <script type="application/json" data-ruby-code="${index}">${jsonPayload}</script>
</div>`;
}

export function getKimiCodeMarkdownDetailPage(
  username: string,
  title: string,
  prompt: string,
  markdown: string
): string {
  const safeUser = escapeHtml(username);
  const segments = splitMarkdownCodeBlocks(markdown);
  let runnableCount = 0;
  let textCount = 0;
  const bodyHtml = segments
    .map((segment) => {
      if (segment.type === 'text') {
        const trimmed = segment.content.trim();
        if (!trimmed) return '';
        return renderTextBlock(segment.content, textCount++);
      }
      if (isRunnableRubyCodeBlock(segment)) {
        return renderRunnableRubyBlock(segment, runnableCount++);
      }
      return renderStaticCodeBlock(segment);
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} - Kimi K2.7 Code</title>
<style>${SHARED_STYLE}</style>
</head>
<body>
<h1>📝 ${escapeHtml(title)}</h1>
<p class="subtitle"><a href="/kimi-code/markdown">← 一覧に戻る</a> ・ <a href="/kimi-code">/kimi-code</a> <span style="color:var(--text-muted);">${safeUser}</span></p>
<div class="panel">
  <div class="panel-label">プロンプト</div>
  <div style="white-space:pre-wrap;">${escapeHtml(prompt)}</div>
</div>
${bodyHtml}
<script>
  ${getMarkdownParserScript()}
  document.querySelectorAll('[data-md-text-source]').forEach(function(el) {
    var index = el.getAttribute('data-md-text-source');
    var target = document.querySelector('[data-md-text="' + index + '"]');
    if (!target) return;
    var payload = JSON.parse(el.textContent);
    target.innerHTML = parseMd(payload.markdown);
  });
</script>
<script type="module">
(function() {
  var runnableCount = ${runnableCount};
  if (runnableCount === 0) return;
  var rubyVM = null;

  import('${RUBY_WASM_JS_URL}').then(function(mod) {
    return fetch('${RUBY_WASM_BINARY_URL}').then(function(res) {
      if (!res.ok) throw new Error('Rubyバイナリの取得に失敗しました: HTTP ' + res.status);
      return WebAssembly.compileStreaming(res);
    }).then(function(compiled) {
      return mod.DefaultRubyVM(compiled, { consolePrint: false });
    }).then(function(result) {
      rubyVM = result.vm;
      document.querySelectorAll('[data-run-ruby-block]').forEach(function(btn) {
        btn.disabled = false;
        btn.textContent = '▶ 実行';
      });
    });
  }).catch(function(err) {
    document.querySelectorAll('[data-run-ruby-block]').forEach(function(btn) {
      btn.textContent = '❌ WASM読み込み失敗';
    });
    console.error(err);
  });

  document.querySelectorAll('[data-run-ruby-block]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!rubyVM) return;
      var index = btn.getAttribute('data-run-ruby-block');
      var codeScript = document.querySelector('[data-ruby-code="' + index + '"]');
      var resultEl = document.querySelector('[data-ruby-result="' + index + '"]');
      var payload = JSON.parse(codeScript.textContent);
      try {
        var wrapped =
          "require 'stringio'\\n" +
          "__out = StringIO.new\\n" +
          "__orig_stdout = $stdout\\n" +
          "$stdout = __out\\n" +
          "begin\\n" +
          payload.code + "\\n" +
          "ensure\\n" +
          "  $stdout = __orig_stdout\\n" +
          "end\\n" +
          "__out.string";
        var output = rubyVM.eval(wrapped).toString();
        resultEl.textContent = output.length > 0 ? output : '(出力なし)';
        resultEl.style.color = '';
      } catch (err) {
        resultEl.style.color = 'var(--danger)';
        resultEl.textContent = err && err.message ? err.message : String(err);
      }
    });
  });
})();
</script>
</body>
</html>`;
}
