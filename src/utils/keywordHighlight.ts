/**
 * 応答バブル(や質問バブル)内のテキストノードを走査し、指定キーワードに
 * 一致する箇所を `<mark class="kw-highlight">` で囲んでハイライトする
 * クライアント側JSを返す。AIチャットの「詳細プレビュー」モーダルと
 * 「画像添付会話のプレビュー」モーダルの両方から共通で使う。
 * 利用側は `.kw-highlight` のCSS(背景色)と、非表示化用に
 * `<コンテナのclass>.highlights-hidden .kw-highlight { background: transparent; ... }`
 * を自前で用意すること(コンテナのclass名がページごとに異なるため)。
 */
export function getKeywordHighlightScript(): string {
  return `
    function applyKeywordHighlight(el, keyword) {
      if (!keyword) return;
      var kwList = Array.isArray(keyword) ? keyword.filter(Boolean) : [keyword];
      if (kwList.length === 0) return;
      var escaped = kwList.map(function(k) { return k.replace(/[.*+?^$\{}()|[\]\\]/g, '\\$&'); });
      var re = new RegExp(escaped.join('|'), 'gi');
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
      var nodes = [];
      var n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function(tn) {
        if (!re.test(tn.nodeValue)) { re.lastIndex = 0; return; }
        re.lastIndex = 0;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        while ((m = re.exec(tn.nodeValue)) !== null) {
          if (m.index > last) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last, m.index)));
          var mark = document.createElement('mark');
          mark.className = 'kw-highlight';
          mark.textContent = m[0];
          frag.appendChild(mark);
          last = re.lastIndex;
        }
        if (last < tn.nodeValue.length) frag.appendChild(document.createTextNode(tn.nodeValue.slice(last)));
        tn.parentNode.replaceChild(frag, tn);
      });
    }
    function clearKeywordHighlights(container) {
      var marks = container.querySelectorAll('.kw-highlight');
      marks.forEach(function(mark) {
        if (mark.parentNode) {
          mark.parentNode.replaceChild(document.createTextNode(mark.textContent), mark);
        }
      });
      if (container.normalize) container.normalize();
    }
  `;
}
