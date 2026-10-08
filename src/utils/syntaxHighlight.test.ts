import { describe, expect, it } from 'vitest';
import { highlightCode } from './syntaxHighlight';

describe('highlightCode', () => {
  // 故障シナリオ(実際に発生した不具合): highlightCode()はaichat.ts/
  // aichat-share.tsでhighlightCode.toString()経由でブラウザの<script>内に
  // 単体で埋め込まれる。この関数の内部にfunction esc(s){...}のような
  // 「変数名に束縛されたfunction」を書くと、esbuildのname保持機能により
  // 関数本体の先頭にバンドル専用のname保持ヘルパー呼び出しが挿入される
  // (wrangler deploy --dry-runで実際のバンドル出力を確認して判明)。
  // このヘルパーはバンドル環境の外(toString()で単体に切り出した文字列を
  // <script>へ埋め込んだ場合)では未定義のため、highlightCode()を呼んだ
  // 瞬間にReferenceErrorが発生し、呼び出し元のparseMd全体が失敗して
  // 共有ページ(/s/:userHash/:id)の本文が空白になった。
  // トップレベルのtoString()出力にそのヘルパー呼び出しが含まれていないことを
  // 確認する(vitestのトランスフォームでは再現しないため、本番相当の再現
  // 確認は`wrangler deploy --dry-run`のバンドル出力で別途行っている)。
  it('toString()で文字列化した関数本体にバンドル専用のname保持ヘルパー呼び出しが含まれない', () => {
    const src = highlightCode.toString();
    const bundlerHelperCall = '__' + 'name(';
    expect(src).not.toContain(bundlerHelperCall);
  });

  it('未対応の言語指定(lang)はHTMLエスケープのみ行い、ハイライトしない', () => {
    const code = 'const x = 1; // <script>';
    expect(highlightCode(code, 'unknownlang')).toBe('const x = 1; // &lt;script&gt;');
  });

  it('JavaScriptのキーワードをtok-kwで囲む', () => {
    const result = highlightCode('const x = 1;', 'javascript');
    expect(result).toContain('<span class="tok-kw">const</span>');
    expect(result).not.toContain('<span class="tok-kw">x</span>');
  });

  it('文字列リテラルをtok-strで囲む(エスケープ文字含む)', () => {
    const result = highlightCode('const s = "hello \\"world\\"";', 'javascript');
    expect(result).toContain('<span class="tok-str">&quot;hello \\&quot;world\\&quot;&quot;</span>');
  });

  it('数値リテラルをtok-numで囲む', () => {
    const result = highlightCode('var n = 42.5;', 'javascript');
    expect(result).toContain('<span class="tok-num">42.5</span>');
  });

  it('行コメント(//)をtok-comで囲み、改行の手前まで対象にする', () => {
    const result = highlightCode('const a = 1; // comment here\nconst b = 2;', 'javascript');
    expect(result).toContain('<span class="tok-com">// comment here</span>');
    expect(result).toContain('<span class="tok-kw">const</span> b');
  });

  it('ブロックコメント(/* */)をtok-comで囲む', () => {
    const result = highlightCode('/* block\ncomment */ const x = 1;', 'javascript');
    expect(result).toContain('<span class="tok-com">/* block\ncomment */</span>');
  });

  it('Pythonは#を行コメントとして扱い、ブロックコメントは持たない(/*はそのまま記号扱い)', () => {
    const result = highlightCode('# comment\ndef f(): pass', 'python');
    expect(result).toContain('<span class="tok-com"># comment</span>');
    expect(result).toContain('<span class="tok-kw">def</span>');
    expect(result).toContain('<span class="tok-kw">pass</span>');
  });

  it('Rubyのキーワード(end等)もtok-kwで囲む', () => {
    const result = highlightCode('def hello\n  puts "hi"\nend', 'ruby');
    expect(result).toContain('<span class="tok-kw">def</span>');
    expect(result).toContain('<span class="tok-kw">end</span>');
    expect(result).toContain('<span class="tok-str">&quot;hi&quot;</span>');
  });

  it('SQLは--を行コメントとして扱い、キーワードは大文字小文字を区別する(大文字のみヒット)', () => {
    const result = highlightCode('-- note\nSELECT * FROM users', 'sql');
    expect(result).toContain('<span class="tok-com">-- note</span>');
    expect(result).toContain('<span class="tok-kw">SELECT</span>');
    expect(result).toContain('<span class="tok-kw">FROM</span>');
  });

  it('HTML特殊文字を含むコードは安全にエスケープされる(XSS対策)', () => {
    const result = highlightCode('const html = "<img src=x onerror=alert(1)>";', 'javascript');
    expect(result).not.toContain('<img src=x onerror=alert(1)>');
    expect(result).toContain('&lt;img');
  });

  it('言語名の大文字小文字を区別しない(JavaScript/JAVASCRIPT等)', () => {
    const result = highlightCode('const x = 1;', 'JavaScript');
    expect(result).toContain('<span class="tok-kw">const</span>');
  });

  it('jsとts/rb等のエイリアス表記でも同じ設定が適用される', () => {
    expect(highlightCode('let x = 1;', 'js')).toContain('<span class="tok-kw">let</span>');
    expect(highlightCode('let x: number = 1;', 'ts')).toContain('<span class="tok-kw">let</span>');
    expect(highlightCode('def f; end', 'rb')).toContain('<span class="tok-kw">def</span>');
  });

  it('JSONはキーワードtrue/false/nullのみハイライトし、キー名はハイライトしない', () => {
    const result = highlightCode('{"ok": true, "value": null}', 'json');
    expect(result).toContain('<span class="tok-kw">true</span>');
    expect(result).toContain('<span class="tok-kw">null</span>');
    expect(result).toContain('<span class="tok-str">&quot;ok&quot;</span>');
  });
});
