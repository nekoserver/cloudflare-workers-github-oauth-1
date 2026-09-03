import { describe, it, expect } from 'vitest';
import { wrapAsMarkdownCodeBlock } from './textToMarkdown';

// 対象: /md-previewページの「Text→.md」ボタン。左のテキストエリアに入力した
// プレーンテキストを、Markdownとして誤解釈されないコードブロックとして
// 右の出力窓に表示する。wrapAsMarkdownCodeBlock(DOM操作を含まない純粋関数)を
// テストする。
//
// 故障シナリオ:
//   (1) 入力テキストに```(3連続バッククォート)が含まれる場合、通常の
//       3本フェンスで囲むとフェンスがテキスト内容と衝突し、コードブロックが
//       途中で終わってしまう
//   (2) 空文字列を渡したときに例外を投げる、またはフェンスが壊れる

describe('wrapAsMarkdownCodeBlock', () => {
  it('通常のテキストは3本のバッククォートで囲む', () => {
    const result = wrapAsMarkdownCodeBlock('hello\nworld');
    expect(result).toBe('```\nhello\nworld\n```');
  });

  it('テキスト中に```が含まれる場合は4本のバッククォートで囲む(衝突回避)', () => {
    const result = wrapAsMarkdownCodeBlock('```js\nconsole.log(1)\n```');
    expect(result.startsWith('````\n')).toBe(true);
    expect(result.endsWith('\n````')).toBe(true);
  });

  it('4本のバッククォートが含まれる場合は5本で囲む', () => {
    const result = wrapAsMarkdownCodeBlock('some ```` fenced text');
    expect(result.startsWith('`````\n')).toBe(true);
    expect(result.endsWith('\n`````')).toBe(true);
  });

  it('空文字列でも例外を投げず3本フェンスで囲む', () => {
    expect(() => wrapAsMarkdownCodeBlock('')).not.toThrow();
    expect(wrapAsMarkdownCodeBlock('')).toBe('```\n\n```');
  });

  it('バッククォートを含まない通常のMarkdown記法(見出し等)もそのまま埋め込む(解釈されない)', () => {
    const result = wrapAsMarkdownCodeBlock('# タイトル\n- 箇条書き');
    expect(result).toBe('```\n# タイトル\n- 箇条書き\n```');
  });
});
