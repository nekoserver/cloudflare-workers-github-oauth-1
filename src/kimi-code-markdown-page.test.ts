import { describe, it, expect } from 'vitest';
import { getKimiCodeMarkdownDetailPage, getKimiCodeMarkdownListPage } from './views/kimiCodeMarkdown';

// 対象: /kimi-code/markdown (一覧) と /kimi-code/markdown/:id (詳細) のHTML生成。
// kimi-codeで生成したコードをMarkdownとして保存した後、Rubyコードブロックだけ
// その場でWASM実行できるようにするビューア。
//
// 故障シナリオ:
//   (1) title/prompt/ユーザー名がエスケープされずXSSにつながる
//   (2) コード本文に含まれるバッククォート・</script>・引用符によって
//       埋め込みJSON/JSが構文的に壊れる
//   (3) Rubyでないコードブロックにまで実行ボタンが表示され、実行不能なのに
//       押せてしまう(あるいはRubyコードなのに実行ボタンが出ない)
//   (4) <script type="module">内のJSに構文エラーがある

const RUBY_CODE = [
  'def greet(name)',
  '  puts "Hello, #{name}!"',
  'end',
].join('\n');

describe('getKimiCodeMarkdownListPage', () => {
  it('一覧が0件の場合は案内文を表示する', () => {
    const html = getKimiCodeMarkdownListPage('tester', []);
    expect(html).toContain('まだ保存されたMarkdownはありません');
  });

  it('各行が詳細ページへのリンクになる', () => {
    const html = getKimiCodeMarkdownListPage('tester', [{ id: 'abc123', title: 'あいさつ', created_at: '2026-01-01 00:00:00' }]);
    expect(html).toContain('/kimi-code/markdown/abc123');
    expect(html).toContain('あいさつ');
  });

  it('titleがエスケープされる', () => {
    const html = getKimiCodeMarkdownListPage('tester', [{ id: 'x', title: '<script>alert(1)</script>', created_at: '2026-01-01' }]);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('getKimiCodeMarkdownDetailPage', () => {
  it('ユーザー名・title・promptがエスケープされる', () => {
    const html = getKimiCodeMarkdownDetailPage('<script>alert(1)</script>', '<b>title</b>', '<i>prompt</i>', '```\ncode\n```');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<b>title</b>');
    expect(html).not.toContain('<i>prompt</i>');
  });

  it('Rubyコードブロックには実行ボタンとJSONペイロードが埋め込まれる', () => {
    const markdown = '```ruby\n' + RUBY_CODE + '\n```';
    const html = getKimiCodeMarkdownDetailPage('tester', 't', 'p', markdown);
    expect(html).toContain('data-run-ruby-block="0"');
    expect(html).toContain('data-ruby-code="0"');
    const scriptMatch = html.match(/<script type="application\/json" data-ruby-code="0">([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const payload = JSON.parse(scriptMatch![1]);
    expect(payload.code).toBe(RUBY_CODE);
  });

  it('言語指定の無いフェンスでもRubyらしければ実行可能として扱う', () => {
    const markdown = '```\n' + RUBY_CODE + '\n```';
    const html = getKimiCodeMarkdownDetailPage('tester', 't', 'p', markdown);
    expect(html).toContain('data-run-ruby-block="0"');
  });

  it('TypeScriptのコードブロックには実行ボタンを出さない', () => {
    const markdown = '```ts\nexport default { fetch() { return new Response("hi"); } };\n```';
    const html = getKimiCodeMarkdownDetailPage('tester', 't', 'p', markdown);
    expect(html).not.toContain('data-run-ruby-block="0"');
    expect(html).toContain('```ts');
  });

  it('コード本文に</script>やバッククォート・引用符が含まれてもJSONペイロードが壊れない', () => {
    const trickyCode = [
      'def render',
      '  puts "</script><script>alert(1)</script>"',
      "  puts 'has `backtick` and \"quote\"'",
      'end',
    ].join('\n');
    const markdown = '```ruby\n' + trickyCode + '\n```';
    const html = getKimiCodeMarkdownDetailPage('tester', 't', 'p', markdown);
    const scriptMatch = html.match(/<script type="application\/json" data-ruby-code="0">([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    const payload = JSON.parse(scriptMatch![1]);
    expect(payload.code).toBe(trickyCode);
  });

  it('地の文が空の場合はブロックを描画しない(空のpanelが並ばない)', () => {
    const markdown = '\n\n```ruby\nputs 1\n```\n\n';
    const html = getKimiCodeMarkdownDetailPage('tester', 't', 'p', markdown);
    // プロンプト用panelを除き、地の文由来の空panelが無いことを確認するため、
    // panel数が「プロンプト1件 + コードブロック1件」の2件であることを見る。
    const panelCount = (html.match(/class="panel"/g) || []).length;
    expect(panelCount).toBe(2);
  });

  it('<script type="module">内のJSに構文エラーがない', () => {
    const markdown = '```ruby\n' + RUBY_CODE + '\n```';
    const html = getKimiCodeMarkdownDetailPage('tester', 't', 'p', markdown);
    const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
    expect(m).not.toBeNull();
    expect(() => new Function('return (async () => { ' + m![1].replace(/import\(/g, 'Promise.resolve(') + ' })')).not.toThrow();
  });

  it('実行可能なコードブロックが無い場合はWASM読み込みを開始しない(runnableCount===0で早期return)', () => {
    const markdown = '```ts\nconst x = 1;\n```';
    const html = getKimiCodeMarkdownDetailPage('tester', 't', 'p', markdown);
    expect(html).toContain('var runnableCount = 0;');
  });
});
