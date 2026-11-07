/**
 * AIチャットの回答待ちの表示(ページのscriptとCSSへ埋め込む)。ユーザー指定(2026-11-07)。
 *
 * 質問を送ってから回答を得るまで、入力窓と応答バブル(考え中のバブル、表示され始めた回答のバブル)の外枠を
 * 同じ色(選んでいるモデルの色)にして点滅させ、「考え中...」の右に、縦長の3本線が左から右へ波のように
 * 上下するSVGアイコンを置く。入力窓の外枠はMuseの接続状態の色(インラインのborderColor)にも使われるが、
 * 点滅はCSSアニメーションなので、待っている間だけそちらより優先され、止めると元の色に戻る。
 * template literalに埋め込むため、バックスラッシュのエスケープと正規表現リテラルを使わない(CLAUDE.md ルール29)。
 */
export const AICHAT_PENDING_CSS = `
    .aichat-pending { animation: aichat-pending-blink 1s ease-in-out infinite; }
    @keyframes aichat-pending-blink {
      0%, 100% { border-color: var(--aichat-pending-color); box-shadow: 0 0 0 1px var(--aichat-pending-color); }
      50% { border-color: var(--border-color); box-shadow: 0 0 0 0 transparent; }
    }
    .aichat-pending-wave { display: inline-block; width: 18px; height: 16px; margin-left: 6px; vertical-align: -3px; color: var(--aichat-pending-color, var(--accent-color, #667eea)); }
    .aichat-pending-wave rect { transform-box: fill-box; transform-origin: center; animation: aichat-pending-wave 0.9s ease-in-out infinite; }
    .aichat-pending-wave rect:nth-child(2) { animation-delay: 0.15s; }
    .aichat-pending-wave rect:nth-child(3) { animation-delay: 0.3s; }
    @keyframes aichat-pending-wave { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
`;

export const AICHAT_PENDING_SCRIPT = `
    var AICHAT_PENDING_FALLBACK_COLOR = 'var(--accent-color, #667eea)';
    var aichatPendingColor = AICHAT_PENDING_FALLBACK_COLOR;
    var aichatPendingCount = 0;

    function setAichatPendingColor(el) {
      el.style.setProperty('--aichat-pending-color', aichatPendingColor);
      el.classList.add('aichat-pending');
    }
    /** 縦長の3本線を左から右へ並べたSVG。CSSで時間差を付けて上下させ、波に見せる。 */
    function createAichatPendingWave() {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('class', 'aichat-pending-wave');
      svg.setAttribute('viewBox', '0 0 18 16');
      svg.setAttribute('aria-hidden', 'true');
      [1, 7.5, 14].forEach(function(x) {
        var rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', '2');
        rect.setAttribute('width', '3');
        rect.setAttribute('height', '12');
        rect.setAttribute('rx', '1.5');
        rect.setAttribute('fill', 'currentColor');
        svg.appendChild(rect);
      });
      return svg;
    }
    /** 回答待ちを始める。bubbleは考え中のバブル(前回の続きを表示するときなど、無ければnull)。 */
    function beginAichatPending(input, bubble, color) {
      aichatPendingColor = color || AICHAT_PENDING_FALLBACK_COLOR;
      aichatPendingCount++;
      setAichatPendingColor(input);
      if (bubble) {
        setAichatPendingColor(bubble);
        var text = bubble.firstElementChild || bubble;
        if (!text.querySelector('.aichat-pending-wave')) text.appendChild(createAichatPendingWave());
      }
    }
    /** 表示され始めた回答のバブルにも、完了まで同じ点滅を付ける。 */
    function markAichatPendingBubble(bubble) {
      if (bubble && aichatPendingCount > 0) setAichatPendingColor(bubble);
    }
    /** 回答待ちを終える。重なっている待ちがすべて終わったら、入力窓と残っているバブルの点滅を止める。 */
    function endAichatPending(input) {
      aichatPendingCount = Math.max(0, aichatPendingCount - 1);
      if (aichatPendingCount > 0) return;
      input.classList.remove('aichat-pending');
      var marked = document.querySelectorAll('.aichat-pending');
      for (var i = 0; i < marked.length; i++) marked[i].classList.remove('aichat-pending');
    }
`;
