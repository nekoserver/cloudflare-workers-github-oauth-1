/**
 * AIチャットのclaude/codex回答内のコードブロックに適用する軽量シンタックス
 * ハイライター。外部ライブラリ(highlight.js等)を導入せず、言語ごとの
 * キーワード集合と行コメント/ブロックコメント/文字列/数値を正規表現で
 * トークン化し、<span class="tok-xxx">で囲んだHTML文字列を返す。
 *
 * ブラウザの<script>内に埋め込むため(aichat.tsでhighlightCode.toString()
 * 経由で文字列化する)、関数の外側のモジュールスコープ変数に依存すると
 * toString()では関数本体の文字列しか得られず参照先が失われてしまう。
 * そのため言語設定の構築も含めてすべて関数本体の中に自己完結させている
 * (矢印関数・分割代入等の新しめの構文も避け、素朴な構文のみ使う)。
 *
 * 対応言語以外・未対応言語はHTMLエスケープのみ行い、ハイライトなしでも
 * 表示が崩れないようにする。
 */
export function highlightCode(code: string, lang: string): string {
  // 注意: ここをfunction esc(s){...}や`var esc = function(s){...}`のように
  // 変数名に束縛したfunctionにすると、esbuildのname保持機能により関数本体の
  // 先頭に name-preserving ヘルパー呼び出し(バンドル専用、シンボル名は
  // アンダースコア2つ+name)が挿入される。この関数はhighlightCode.toString()
  // で文字列化してブラウザのscript要素内に単体で埋め込む用途(aichat.ts/
  // aichat-share.ts)のため、バンドル環境の外ではそのヘルパーが未定義となり
  // ReferenceErrorでparseMd全体が失敗する(共有ページの本文が空白になった
  // 不具合の原因)。配列要素としてfunctionを置くことで変数名への束縛を避け、
  // esbuildに名前を推論させない。
  var esc = [function (s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }][0];

  var jsKeywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'class', 'extends', 'new', 'this', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'import', 'export', 'default', 'from', 'typeof', 'instanceof', 'in', 'of', 'null', 'undefined', 'true', 'false', 'void', 'delete', 'yield', 'static', 'get', 'set', 'super'];
  var tsKeywords = jsKeywords.concat(['interface', 'type', 'enum', 'implements', 'public', 'private', 'protected', 'readonly', 'as', 'namespace', 'declare', 'abstract']);
  var pyKeywords = ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'class', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'pass', 'yield', 'global', 'nonlocal', 'in', 'is', 'not', 'and', 'or', 'None', 'True', 'False', 'async', 'await', 'del', 'assert'];
  var rubyKeywords = ['def', 'end', 'return', 'if', 'elsif', 'else', 'unless', 'for', 'while', 'until', 'break', 'next', 'class', 'module', 'require', 'require_relative', 'begin', 'rescue', 'ensure', 'raise', 'do', 'yield', 'nil', 'true', 'false', 'and', 'or', 'not', 'self', 'case', 'when', 'then'];
  var sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'UNIQUE', 'DISTINCT', 'UNION', 'ALL', 'EXISTS', 'CASE', 'WHEN', 'THEN', 'END'];
  var shellKeywords = ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'export', 'local', 'echo', 'exit', 'break', 'continue', 'in'];
  var goKeywords = ['func', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'break', 'continue', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'default', 'nil', 'true', 'false'];
  var rustKeywords = ['fn', 'let', 'mut', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'break', 'continue', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'self', 'Self', 'true', 'false', 'None', 'Some', 'Ok', 'Err', 'async', 'await'];
  var javaKeywords = ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'new', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'this', 'super', 'null', 'true', 'false'];
  var cKeywords = ['int', 'char', 'float', 'double', 'void', 'long', 'short', 'unsigned', 'signed', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'struct', 'typedef', 'static', 'const', 'sizeof', 'include', 'define', 'extern'];
  var cppKeywords = cKeywords.concat(['class', 'public', 'private', 'protected', 'namespace', 'using', 'new', 'delete', 'template', 'virtual', 'override', 'true', 'false', 'nullptr']);

  var jsConfig = { keywords: jsKeywords, lineComment: '//', blockComment: true };
  var tsConfig = { keywords: tsKeywords, lineComment: '//', blockComment: true };
  var pyConfig = { keywords: pyKeywords, lineComment: '#', blockComment: false };
  var rubyConfig = { keywords: rubyKeywords, lineComment: '#', blockComment: false };
  var sqlConfig = { keywords: sqlKeywords, lineComment: '--', blockComment: true };
  var shellConfig = { keywords: shellKeywords, lineComment: '#', blockComment: false };
  var goConfig = { keywords: goKeywords, lineComment: '//', blockComment: true };
  var rustConfig = { keywords: rustKeywords, lineComment: '//', blockComment: true };
  var javaConfig = { keywords: javaKeywords, lineComment: '//', blockComment: true };
  var cConfig = { keywords: cKeywords, lineComment: '//', blockComment: true };
  var cppConfig = { keywords: cppKeywords, lineComment: '//', blockComment: true };
  var jsonConfig = { keywords: ['true', 'false', 'null'], lineComment: null as string | null, blockComment: false };

  var configs: Record<string, { keywords: string[]; lineComment: string | null; blockComment: boolean }> = {
    js: jsConfig, javascript: jsConfig, jsx: jsConfig,
    ts: tsConfig, typescript: tsConfig, tsx: tsConfig,
    py: pyConfig, python: pyConfig,
    rb: rubyConfig, ruby: rubyConfig,
    sql: sqlConfig,
    sh: shellConfig, bash: shellConfig, shell: shellConfig,
    go: goConfig,
    rust: rustConfig, rs: rustConfig,
    java: javaConfig,
    c: cConfig,
    cpp: cppConfig, 'c++': cppConfig,
    json: jsonConfig,
  };

  var config = configs[lang.toLowerCase()];
  if (!config) return esc(code);

  var keywordSet: Record<string, boolean> = {};
  for (var k = 0; k < config.keywords.length; k++) keywordSet[config.keywords[k]] = true;

  var parts: string[] = [];
  var i = 0;
  var n = code.length;

  while (i < n) {
    var rest = code.slice(i);

    if (config.lineComment && rest.indexOf(config.lineComment) === 0) {
      var lineEnd = code.indexOf('\n', i);
      var lineStop = lineEnd === -1 ? n : lineEnd;
      parts.push('<span class="tok-com">' + esc(code.slice(i, lineStop)) + '</span>');
      i = lineStop;
      continue;
    }

    if (config.blockComment && rest.indexOf('/*') === 0) {
      var blockEnd = code.indexOf('*/', i + 2);
      var blockStop = blockEnd === -1 ? n : blockEnd + 2;
      parts.push('<span class="tok-com">' + esc(code.slice(i, blockStop)) + '</span>');
      i = blockStop;
      continue;
    }

    var ch = code.charAt(i);
    if (ch === '"' || ch === '\'' || ch === '`') {
      var j = i + 1;
      while (j < n && code.charAt(j) !== ch) {
        if (code.charAt(j) === '\\') j++;
        j++;
      }
      j = Math.min(j + 1, n);
      parts.push('<span class="tok-str">' + esc(code.slice(i, j)) + '</span>');
      i = j;
      continue;
    }

    var numMatch = rest.match(/^\d+\.?\d*/);
    if (numMatch && numMatch[0]) {
      parts.push('<span class="tok-num">' + esc(numMatch[0]) + '</span>');
      i += numMatch[0].length;
      continue;
    }

    var identMatch = rest.match(/^[A-Za-z_]\w*/);
    if (identMatch && identMatch[0]) {
      var word = identMatch[0];
      if (keywordSet[word]) {
        parts.push('<span class="tok-kw">' + esc(word) + '</span>');
      } else {
        parts.push(esc(word));
      }
      i += word.length;
      continue;
    }

    parts.push(esc(ch));
    i++;
  }

  return parts.join('');
}
