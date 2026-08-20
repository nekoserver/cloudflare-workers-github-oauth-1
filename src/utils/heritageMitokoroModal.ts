/**
 * 世界遺産の「見どころ」AI回答(見どころキャッシュ)を、name→shareIdのマップとして
 * バッチ取得し、モーダルで表示するためのクライアント側JSを返す共通モジュール。
 *
 * 元々 src/views/webglHeritage.ts (3D地球儀ページ) のツールチップにのみ実装されて
 * いたロジックを、他ページ(src/views/heritageJourney.ts の巡回テストのタップ
 * ツールチップなど)でも再利用できるよう抽出したもの。
 *
 * これらはtemplate literalでHTMLページ全体を組み立てる構造(実際のESモジュールでは
 * ない)のページに埋め込むため、getKeywordHighlightScript()と同じパターンで
 * 「JSソース文字列を返す関数」として提供する。利用側は以下を担当すること:
 *   - `${getMarkdownParserScript()}` (parseMd/esc) を同じ<script>ブロック内に埋め込む
 *   - `${getMitokoroModalCss()}` を<style>ブロックに埋め込む(.mitokoro-md用)
 *   - `${getHeritageMitokoroModalScript()}` を同じ<script>ブロックに埋め込む
 *   - ページ側で `fetchHeritageMitokoroShareIds(names, onUpdate)` を呼び出し、
 *     取得できたname→{gemma:shareId|undefined, llama:shareId|undefined}の
 *     マップを使い、gemma/llamaそれぞれ独立に👀/👁️アイコンを表示する。
 *     タップ時は `openHeritageMitokoroModal(icon, name, shareId)` を呼ぶ
 *     (iconは呼び出し側で'👀'/'👁️'を指定する。webglHeritage.tsのツールチップ
 *     と同じく、両方存在すれば両方のアイコンを同時に出す。片方優先で
 *     もう片方を握りつぶしてはならない)
 */

/** .mitokoro-md用のCSS(見どころモーダル本文のMarkdown描画スタイル)を返す。 */
export function getMitokoroModalCss(): string {
  return `
.mitokoro-md h1,.mitokoro-md h2,.mitokoro-md h3,.mitokoro-md h4,.mitokoro-md h5,.mitokoro-md h6 { color:#e6edf3; font-weight:700; margin:12px 0 6px; }
.mitokoro-md h1 { font-size:1.3em; } .mitokoro-md h2 { font-size:1.18em; } .mitokoro-md h3 { font-size:1.08em; }
.mitokoro-md p { margin:0 0 10px; }
.mitokoro-md ul,.mitokoro-md ol { margin:0 0 10px; padding-left:1.6em; }
.mitokoro-md li { margin:3px 0; }
.mitokoro-md blockquote { border-left:3px solid #388bfd; padding:6px 12px; margin:0 0 10px; background:rgba(56,139,253,0.08); border-radius:0 6px 6px 0; color:#8b949e; }
.mitokoro-md code { background:#161b22; padding:2px 5px; border-radius:4px; font-family:Monaco,Menlo,'Courier New',monospace; font-size:0.9em; }
.mitokoro-md pre { background:#161b22; padding:10px; border-radius:6px; overflow-x:auto; margin:0 0 10px; }
.mitokoro-md pre code { background:none; padding:0; }
.mitokoro-md a { color:#58a6ff; text-decoration:none; }
.mitokoro-md a:hover { text-decoration:underline; }
.mitokoro-md hr { border:none; border-top:1px solid #21262d; margin:12px 0; }
.mitokoro-md table { border-collapse:collapse; width:100%; margin:0 0 10px; font-size:0.95em; }
.mitokoro-md th,.mitokoro-md td { border:1px solid #21262d; padding:5px 8px; text-align:left; }
.mitokoro-md th { background:#161b22; }
`;
}

/**
 * 見どころキャッシュのバッチ確認・モーダル表示に必要なクライアント側JSを返す。
 * 提供する関数:
 *   - fetchHeritageMitokoroShareIds(names, onUpdate): gemma/llama両モデルの
 *     バッチ確認APIを呼び、取得できたname→{icon,shareId}のマップを
 *     onUpdate(map)へ都度渡す(gemma優先、無ければllama)。
 *   - openHeritageMitokoroModal(icon, heritageName, shareId): getNextZ()で
 *     最前面に重ねたモーダルを開き、/api/aichat/shares/{shareId}から回答を
 *     取得してparseMdでMarkdown描画、キーワードハイライトのトグルも提供する。
 * 利用側の<script>ブロックに getMarkdownParserScript() が既に埋め込まれている
 * (parseMd/escが定義済みである)ことを前提とする。
 */
export function getHeritageMitokoroModalScript(): string {
  return `
    var HERITAGE_MITOKORO_GEMMA_MODEL = '@cf/google/gemma-4-26b-a4b-it';

    // heritage-accessページのAI回答には「「国名」にある」という接頭辞が付与された
    // まま保存されているため、見どころモーダル表示時にこれを取り除く。
    function stripHeritageCountryPrefix(text) {
      return String(text || '').replace(/^「[^」]+」にある[、,。 　]*/, '');
    }

    /**
     * gemma/llamaの両バッチ確認APIを呼び、name→{gemma:shareId|undefined,
     * llama:shareId|undefined}のマップをonUpdate(map)に渡す。
     * webglHeritage.ts(3D地球儀ページ)本来の挙動と同じく、gemma回答と
     * llama回答は互いに排他ではなく、同じ世界遺産で両方存在すれば
     * 👀(gemma)・👁️(llama)の両アイコンを独立して出す(片方優先で片方を
     * 握りつぶさない)。どちらかのAPIが失敗してももう一方の結果は反映する。
     */
    function fetchHeritageMitokoroShareIds(names, onUpdate) {
      var merged = {};
      function apply(cached, key) {
        if (!cached) return;
        Object.keys(cached).forEach(function(name) {
          if (!merged[name]) merged[name] = {};
          merged[name][key] = cached[name];
        });
        onUpdate(merged);
      }
      fetch('/api/aichat/check-heritage-mitokoro-gemma-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heritages: names })
      }).then(function(r) { return r.json(); }).then(function(d) {
        apply(d && d.cached, 'gemma');
      }).catch(function(){});

      fetch('/api/aichat/check-heritage-mitokoro-llama-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heritages: names })
      }).then(function(r) { return r.json(); }).then(function(d) {
        apply(d && d.cached, 'llama');
      }).catch(function(){});
    }

    function heritageMitokoroGetNextZ() {
      var max = 500;
      document.querySelectorAll('body *').forEach(function(el) {
        var z = parseInt(window.getComputedStyle(el).zIndex, 10);
        if (!isNaN(z)) max = Math.max(max, z);
      });
      document.querySelectorAll('div[data-overlay]').forEach(function(el) {
        var z = parseInt(el.style.zIndex, 10);
        if (!isNaN(z)) max = Math.max(max, z);
      });
      return max + 100;
    }

    function renderMitokoroAnswerWithKeywordHighlights(answerText, keywords, enabled) {
      var html = parseMd(answerText || '');
      if (!enabled || !keywords || !keywords.length) return html;
      var temp = document.createElement('div');
      temp.innerHTML = html;
      var sorted = keywords.slice().filter(Boolean).sort(function(a, b) { return b.length - a.length; });
      function markTextNode(node) {
        var text = node.nodeValue || '';
        var frag = document.createDocumentFragment();
        var pos = 0;
        while (pos < text.length) {
          var bestKw = null;
          var bestIdx = -1;
          sorted.forEach(function(kw) {
            var idx = text.indexOf(kw, pos);
            if (idx >= 0 && (bestIdx < 0 || idx < bestIdx || (idx === bestIdx && kw.length > (bestKw || '').length))) {
              bestIdx = idx;
              bestKw = kw;
            }
          });
          if (!bestKw || bestIdx < 0) {
            frag.appendChild(document.createTextNode(text.slice(pos)));
            break;
          }
          if (bestIdx > pos) frag.appendChild(document.createTextNode(text.slice(pos, bestIdx)));
          var span = document.createElement('span');
          span.style.background = 'rgba(255, 245, 157, 0.45)';
          span.style.color = '#fff8c5';
          span.style.borderRadius = '3px';
          span.style.padding = '0 2px';
          span.textContent = text.slice(bestIdx, bestIdx + bestKw.length);
          frag.appendChild(span);
          pos = bestIdx + bestKw.length;
        }
        node.parentNode.replaceChild(frag, node);
      }
      function walk(node) {
        var children = Array.prototype.slice.call(node.childNodes || []);
        children.forEach(function(child) {
          if (child.nodeType === 3) markTextNode(child);
          else if (child.nodeType === 1) walk(child);
        });
      }
      walk(temp);
      return temp.innerHTML;
    }

    function openHeritageMitokoroModal(icon, heritageName, shareId) {
      var overlay = document.createElement('div');
      overlay.setAttribute('data-overlay', '');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:' + heritageMitokoroGetNextZ() + ';display:flex;align-items:center;justify-content:center;padding:20px;';

      var box = document.createElement('div');
      box.style.cssText = 'background:#0d1117;border:1px solid #388bfd;border-radius:12px;width:min(560px,94vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

      var head = document.createElement('div');
      head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #21262d;flex-shrink:0;gap:10px;';
      var titleEl = document.createElement('span');
      titleEl.textContent = icon + ' ' + heritageName + ' — 見どころ';
      titleEl.style.cssText = 'font-weight:700;font-size:13px;color:#e6edf3;';
      var keywordToggle = document.createElement('button');
      keywordToggle.style.cssText = 'display:none;background:#3b2f00;border:1px solid #d29922;border-radius:999px;color:#ffd33d;font-size:11px;padding:3px 9px;cursor:pointer;flex-shrink:0;';
      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.setAttribute('aria-label', '閉じる');
      closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:16px;color:#8b949e;padding:4px 8px;flex-shrink:0;';
      closeBtn.addEventListener('click', function() { document.body.removeChild(overlay); });
      head.appendChild(titleEl);
      head.appendChild(keywordToggle);
      head.appendChild(closeBtn);
      box.appendChild(head);

      var body = document.createElement('div');
      body.className = 'mitokoro-md';
      body.style.cssText = 'padding:16px 18px;overflow-y:auto;flex:1;font-size:13px;color:#c9d1d9;line-height:1.7;';
      body.textContent = '読み込み中...';
      box.appendChild(body);

      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) { if (e.target === overlay) document.body.removeChild(overlay); });
      document.body.appendChild(overlay);

      var answerText = '';
      var hitKeywords = [];
      var highlightEnabled = false;
      function renderAnswer() {
        body.innerHTML = renderMitokoroAnswerWithKeywordHighlights(answerText, hitKeywords, highlightEnabled);
      }

      fetch('/api/aichat/shares/' + encodeURIComponent(shareId))
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.answer) {
            answerText = stripHeritageCountryPrefix(data.answer);
            renderAnswer();
            return fetch('/api/aichat/heritage-mitokoro-keyword-hits?heritage=' + encodeURIComponent(heritageName) + '&model=' + encodeURIComponent(HERITAGE_MITOKORO_GEMMA_MODEL));
          }
          body.textContent = data.error || '（応答なし）';
          return null;
        })
        .then(function(r) { return r ? r.json() : null; })
        .then(function(data) {
          if (!data || !data.hitCount) return;
          hitKeywords = data.keywords || [];
          keywordToggle.textContent = '🔑(' + data.hitCount + ')';
          keywordToggle.style.display = '';
          keywordToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            highlightEnabled = !highlightEnabled;
            keywordToggle.style.background = highlightEnabled ? '#6b4e00' : '#3b2f00';
            renderAnswer();
          });
        })
        .catch(function() {
          body.textContent = '通信エラーが発生しました。';
        });
    }
  `;
}
