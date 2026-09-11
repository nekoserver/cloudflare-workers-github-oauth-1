import { describe, it, expect } from 'vitest';
import { splitMarkdownCodeBlocks, wrapCodeAsMarkdown, isRunnableRubyCodeBlock } from './utils/markdownCodeBlocks';

// 対象: /kimi-code/markdown/:id ページ(kimi-codeの生成結果をMarkdownとして
// 保存し、後から閲覧できるようにする機能)の元になる純粋関数群。
//
// 故障シナリオ:
//   (1) コードフェンスの分割位置がずれて、コード本文の一部が地の文として
//       (=シンタックスハイライト無し・実行不可のまま)表示されてしまう
//   (2) 言語指定の無いフェンス(```のみ)のコードがRubyかどうか判定できず、
//       実行ボタンが出ないままになる
//   (3) 既にMarkdown形式(```を含む)の生成結果を二重にフェンスしてしまい、
//       表示が壊れる

const RUBY_CODE = [
  'def greet(name)',
  '  puts "Hello, #{name}!"',
  'end',
].join('\n');

describe('splitMarkdownCodeBlocks', () => {
  it('地の文のみのMarkdownは1個のtextセグメントになる', () => {
    expect(splitMarkdownCodeBlocks('ただの説明文です')).toEqual([{ type: 'text', content: 'ただの説明文です' }]);
  });

  it('地の文→コード→地の文の3セグメントに分割する', () => {
    const markdown = '説明:\n```ruby\nputs 1\n```\n続き';
    expect(splitMarkdownCodeBlocks(markdown)).toEqual([
      { type: 'text', content: '説明:\n' },
      { type: 'code', content: 'puts 1', lang: 'ruby' },
      { type: 'text', content: '\n続き' },
    ]);
  });

  it('言語指定の無いフェンスはlang:""として分割する', () => {
    const markdown = '```\nconst x = 1;\n```';
    expect(splitMarkdownCodeBlocks(markdown)).toEqual([{ type: 'code', content: 'const x = 1;', lang: '' }]);
  });

  it('言語指定は小文字化される', () => {
    const markdown = '```Ruby\nputs 1\n```';
    expect(splitMarkdownCodeBlocks(markdown)[0]).toEqual({ type: 'code', content: 'puts 1', lang: 'ruby' });
  });

  it('複数のコードブロックをそれぞれ独立したセグメントに分割する', () => {
    const markdown = '```ruby\na\n```\n中間\n```js\nb\n```';
    const result = splitMarkdownCodeBlocks(markdown);
    expect(result.filter((s) => s.type === 'code')).toHaveLength(2);
  });
});

describe('wrapCodeAsMarkdown', () => {
  it('既に```を含むコードはそのまま返す(二重フェンスしない)', () => {
    const markdown = '```ruby\nputs 1\n```';
    expect(wrapCodeAsMarkdown(markdown)).toBe(markdown);
  });

  it('フェンスの無いRubyコードは```rubyで囲む', () => {
    const wrapped = wrapCodeAsMarkdown(RUBY_CODE);
    expect(wrapped).toBe('```ruby\n' + RUBY_CODE + '\n```');
  });

  it('フェンスの無いTypeScriptコードは言語指定無しの```で囲む', () => {
    const code = 'export default { fetch() { return new Response("hi"); } };';
    expect(wrapCodeAsMarkdown(code)).toBe('```\n' + code + '\n```');
  });
});

describe('isRunnableRubyCodeBlock', () => {
  it('lang:rubyは実行可能とみなす', () => {
    expect(isRunnableRubyCodeBlock({ lang: 'ruby', content: 'anything' })).toBe(true);
  });

  it('lang:rbも実行可能とみなす', () => {
    expect(isRunnableRubyCodeBlock({ lang: 'rb', content: 'anything' })).toBe(true);
  });

  it('言語指定が無い場合はコード内容からRubyらしさを判定する', () => {
    expect(isRunnableRubyCodeBlock({ lang: '', content: RUBY_CODE })).toBe(true);
    expect(isRunnableRubyCodeBlock({ lang: '', content: 'const x = 1;' })).toBe(false);
  });

  it('lang:jsのように明示的に他言語指定がある場合は実行可能としない', () => {
    expect(isRunnableRubyCodeBlock({ lang: 'js', content: RUBY_CODE })).toBe(false);
  });
});
