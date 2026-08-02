/**
 * クライアントサイドで完結する軽量Markdownパーサーのスクリプト文字列を返す。
 * <script>ブロック内に埋め込んで parseMd(src) を呼び出すことで、DOM依存なしに
 * MarkdownをHTML文字列へ変換できる（見出し・リスト・テーブル・引用・コードブロック・
 * 太字/斜体/取り消し線・リンク/画像・タスクリストに対応）。
 *
 * セキュリティ: 生テキストは esc() でHTMLエスケープしてからMarkdown記法を適用するため、
 * 入力に生の <script> 等のHTMLタグが含まれていてもテキストとして表示される
 * （AI生成テキストなど非信頼の入力を innerHTML で描画する用途を想定）。
 * リンク・画像URLは javascript: 等の危険なスキームを拒否する。
 */
export function getMarkdownParserScript(): string {
  return `
    function parseMd(src) {
      src = src.replace(/\\r\\n?/g, '\\n');

      var codeBlocks = [];
      src = src.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(_, lang, code) {
        var i = codeBlocks.length;
        codeBlocks.push('<pre><code' + (lang ? ' class="language-' + lang + '"' : '') + '>' + esc(code.replace(/\\n$/, '')) + '</code></pre>');
        return '\\x00CB' + i + '\\x00';
      });

      var inlineCodes = [];
      src = src.replace(/\`([^\`]+)\`/g, function(_, code) {
        var i = inlineCodes.length;
        inlineCodes.push('<code>' + esc(code) + '</code>');
        return '\\x00IC' + i + '\\x00';
      });

      var lines = src.split('\\n');
      var html = '';
      var i = 0;

      while (i < lines.length) {
        var line = lines[i];

        if (line.trim() === '') { i++; continue; }

        var cbMatch = line.match(/^\\x00CB(\\d+)\\x00$/);
        if (cbMatch) { html += codeBlocks[parseInt(cbMatch[1])]; i++; continue; }

        var hMatch = line.match(/^(#{1,6})\\s+(.+)$/);
        if (hMatch) {
          var level = hMatch[1].length;
          html += '<h' + level + '>' + inline(hMatch[2]) + '</h' + level + '>';
          i++; continue;
        }

        if (/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(line)) {
          html += '<hr>'; i++; continue;
        }

        if (i + 1 < lines.length && /^\\|/.test(line) && /^[\\|\\s:-]+$/.test(lines[i+1])) {
          var tbl = '<table><thead><tr>';
          var heads = splitTableRow(line);
          for (var h = 0; h < heads.length; h++) tbl += '<th>' + inline(heads[h].trim()) + '</th>';
          tbl += '</tr></thead><tbody>';
          i += 2;
          while (i < lines.length && /^\\|/.test(lines[i])) {
            tbl += '<tr>';
            var cells = splitTableRow(lines[i]);
            for (var c = 0; c < cells.length; c++) tbl += '<td>' + inline(cells[c].trim()) + '</td>';
            tbl += '</tr>'; i++;
          }
          tbl += '</tbody></table>';
          html += tbl; continue;
        }

        if (/^>\\s?/.test(line)) {
          var bqLines = [];
          while (i < lines.length && /^>\\s?/.test(lines[i])) {
            bqLines.push(lines[i].replace(/^>\\s?/, ''));
            i++;
          }
          html += '<blockquote>' + parseMd(bqLines.join('\\n')) + '</blockquote>';
          continue;
        }

        if (/^\\s*[-*+]\\s/.test(line)) {
          html += parseList(lines, i, 'ul');
          while (i < lines.length && (/^\\s*[-*+]\\s/.test(lines[i]) || /^\\s{2,}/.test(lines[i]))) i++;
          continue;
        }

        if (/^\\s*\\d+\\.\\s/.test(line)) {
          html += parseList(lines, i, 'ol');
          while (i < lines.length && (/^\\s*\\d+\\.\\s/.test(lines[i]) || /^\\s{2,}/.test(lines[i]))) i++;
          continue;
        }

        var pLines = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\\s/.test(lines[i]) && !/^(\\*{3,}|-{3,}|_{3,})\\s*$/.test(lines[i]) && !/^>\\s?/.test(lines[i]) && !/^\\|/.test(lines[i]) && !/^\\x00CB/.test(lines[i])) {
          pLines.push(lines[i]); i++;
        }
        if (pLines.length) html += '<p>' + inline(pLines.join('\\n')) + '</p>';
      }

      html = html.replace(/\\x00IC(\\d+)\\x00/g, function(_, idx) { return inlineCodes[parseInt(idx)]; });

      return html;
    }

    function splitTableRow(line) {
      return line.replace(/^\\|\\s*/, '').replace(/\\s*\\|$/, '').split(/\\s*\\|\\s*/);
    }

    function parseList(lines, start, tag) {
      var items = [];
      var i = start;
      var pattern = tag === 'ul' ? /^\\s*[-*+]\\s(.*)/ : /^\\s*\\d+\\.\\s(.*)/;
      while (i < lines.length) {
        var m = lines[i].match(pattern);
        if (m) {
          var text = m[1];
          var taskMatch = text.match(/^\\[([ xX])\\]\\s(.*)/);
          if (taskMatch) {
            var checked = taskMatch[1] !== ' ' ? ' checked disabled' : ' disabled';
            items.push('<li class="task-list-item"><input type="checkbox"' + checked + '>' + inline(taskMatch[2]) + '</li>');
          } else {
            items.push('<li>' + inline(text) + '</li>');
          }
          i++;
        } else {
          break;
        }
      }
      return '<' + tag + '>' + items.join('') + '</' + tag + '>';
    }

    function isSafeMdUrl(url) {
      var trimmed = url.replace(/[\\x00-\\x20]/g, '').toLowerCase();
      return !/^(javascript|data|vbscript):/.test(trimmed);
    }

    function inline(text) {
      text = esc(text);
      var latexMap = {
        rightarrow:'→',to:'→',longrightarrow:'⟶',leftarrow:'←',longleftarrow:'⟵',
        Rightarrow:'⇒',Leftarrow:'⇐',leftrightarrow:'↔',Leftrightarrow:'⟺',
        uparrow:'↑',downarrow:'↓',nearrow:'↗',searrow:'↘',
        times:'×',div:'÷',pm:'±',mp:'∓',cdot:'·',
        geq:'≥',leq:'≤',neq:'≠',approx:'≈',equiv:'≡',
        infty:'∞',ldots:'…',cdots:'⋯',
        sum:'∑',prod:'∏',int:'∫',partial:'∂',nabla:'∇',sqrt:'√',
        in:'∈',notin:'∉',subset:'⊂',supset:'⊃',cup:'∪',cap:'∩',emptyset:'∅',
        forall:'∀',exists:'∃',
        alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',zeta:'ζ',
        eta:'η',theta:'θ',iota:'ι',kappa:'κ',lambda:'λ',mu:'μ',
        nu:'ν',xi:'ξ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',
        upsilon:'υ',phi:'φ',chi:'χ',psi:'ψ',omega:'ω',
        Alpha:'Α',Beta:'Β',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',
        Pi:'Π',Sigma:'Σ',Phi:'Φ',Omega:'Ω',
      };
      text = text.replace(/\\$\\\\([a-zA-Z]+)\\$/g, function(_, cmd) {
        return latexMap[cmd] !== undefined ? latexMap[cmd] : ('$\\\\' + cmd + '$');
      });
      text = text.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, function(_, alt, url) {
        return isSafeMdUrl(url) ? '<img src="' + url + '" alt="' + alt + '">' : esc(_);
      });
      text = text.replace(/\\[([^\\]]*)\\]\\(([^)]+)\\)/g, function(_, label, url) {
        return isSafeMdUrl(url) ? '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>' : label;
      });
      text = text.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
      text = text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
      text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
      text = text.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
      text = text.replace(/_(.+?)_/g, '<em>$1</em>');
      text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
      text = text.replace(/\\n/g, '<br>');
      return text;
    }

    function esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  `;
}

/**
 * Markdownプレビュー用のCSS（.preview-area 配下の要素スタイル）。
 * getMarkdownParserScript() が生成するHTML要素に対応する。
 */
export function getMarkdownPreviewCSS(): string {
  return `
    .preview-area h1 { font-size: 2em; font-weight: 700; color: var(--text-primary); margin: 24px 0 16px; padding-bottom: 8px; border-bottom: 2px solid var(--border-color); }
    .preview-area h2 { font-size: 1.5em; font-weight: 600; color: var(--text-primary); margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border-color); }
    .preview-area h3 { font-size: 1.25em; font-weight: 600; color: var(--text-primary); margin: 16px 0 8px; }
    .preview-area h4 { font-size: 1.1em; font-weight: 600; color: var(--text-primary); margin: 14px 0 6px; }
    .preview-area h5, .preview-area h6 { font-size: 1em; font-weight: 600; color: var(--text-muted); margin: 12px 0 6px; }

    .preview-area p { margin: 0 0 16px; }
    .preview-area ul, .preview-area ol { margin: 0 0 16px; padding-left: 2em; }
    .preview-area li { margin: 4px 0; }
    .preview-area li > ul, .preview-area li > ol { margin: 4px 0 4px; }

    .preview-area blockquote {
      border-left: 4px solid var(--accent-color);
      padding: 8px 16px;
      margin: 0 0 16px;
      background: var(--bg-secondary);
      border-radius: 0 6px 6px 0;
      color: var(--text-muted);
    }

    .preview-area code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 0.9em;
    }

    .preview-area pre {
      background: var(--code-bg);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 0 0 16px;
    }

    .preview-area pre code {
      background: none;
      padding: 0;
      font-size: 0.88em;
      line-height: 1.6;
    }

    .preview-area table {
      border-collapse: collapse;
      width: 100%;
      margin: 0 0 16px;
    }

    .preview-area th, .preview-area td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: left;
    }

    .preview-area th {
      background: var(--bg-secondary);
      font-weight: 600;
      color: var(--text-primary);
    }

    .preview-area hr {
      border: none;
      border-top: 2px solid var(--border-color);
      margin: 24px 0;
    }

    .preview-area a { color: var(--accent-color); text-decoration: none; }
    .preview-area a:hover { text-decoration: underline; }

    .preview-area img { max-width: 100%; height: auto; border-radius: 8px; }

    .preview-area .task-list-item { list-style: none; margin-left: -1.5em; }
    .preview-area .task-list-item input[type="checkbox"] { margin-right: 6px; }
  `;
}
