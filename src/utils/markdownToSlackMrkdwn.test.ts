import { describe, it, expect } from 'vitest';
import { convertMarkdownToSlackMrkdwn } from './markdownToSlackMrkdwn';

// 対象: Slackの@メンションAI応答用に、AIが生成したMarkdown(GFM相当)を
// Slackのメッセージ記法(mrkdwn)へ変換するconvertMarkdownToSlackMrkdwn。
//
// 故障シナリオ:
//   (1) 見出し・太字・斜体・リンク・箇条書きがSlackで正しく表示されない
//       記法のまま残る
//   (2) コードブロック/インラインコードの中身が、見出しや箇条書きの
//       変換規則によって意図せず書き換えられる
//   (3) **太字**を*太字*に変換した結果を、続く斜体変換が再度_太字_に
//       変換してしまう(二重変換)
//   (4) &, <, > がエスケープされず、Slack側でリンク/メンション記法と
//       衝突してメッセージが壊れる
//   (5) 生成したリンク記法<url|text>自体が、その後のエスケープ処理で
//       壊れてしまう

describe('convertMarkdownToSlackMrkdwn', () => {
  it('見出し(#〜######)を太字1行に変換する', () => {
    expect(convertMarkdownToSlackMrkdwn('# 見出し')).toBe('*見出し*');
    expect(convertMarkdownToSlackMrkdwn('### 小見出し')).toBe('*小見出し*');
  });

  it('**太字**を*太字*に変換する(二重変換しない)', () => {
    expect(convertMarkdownToSlackMrkdwn('これは**重要**です')).toBe('これは*重要*です');
  });

  it('__太字__も*太字*に変換する', () => {
    expect(convertMarkdownToSlackMrkdwn('これは__重要__です')).toBe('これは*重要*です');
  });

  it('*斜体*を_斜体_に変換する', () => {
    expect(convertMarkdownToSlackMrkdwn('これは*補足*です')).toBe('これは_補足_です');
  });

  it('太字と斜体が同じ文中にあっても正しく区別して変換する', () => {
    expect(convertMarkdownToSlackMrkdwn('**太字**と*斜体*の両方')).toBe('*太字*と_斜体_の両方');
  });

  it('リンク記法[text](url)を<url|text>に変換する', () => {
    expect(convertMarkdownToSlackMrkdwn('[公式サイト](https://example.com)を見てください'))
      .toBe('<https://example.com|公式サイト>を見てください');
  });

  it('箇条書き(- item / * item)を• itemに変換する', () => {
    const md = '- 項目1\n* 項目2\n- 項目3';
    expect(convertMarkdownToSlackMrkdwn(md)).toBe('• 項目1\n• 項目2\n• 項目3');
  });

  it('フェンスコードブロックの中身は変換規則の影響を受けない', () => {
    const md = '説明文です\n```\n# これはコード内のコメント\n**not bold**\n- not a bullet\n```\n続き';
    const result = convertMarkdownToSlackMrkdwn(md);
    expect(result).toContain('```\n# これはコード内のコメント\n**not bold**\n- not a bullet\n```');
    expect(result.startsWith('説明文です\n')).toBe(true);
    expect(result.endsWith('\n続き')).toBe(true);
  });

  it('インラインコードの中身は変換規則の影響を受けない', () => {
    const md = '`**not bold**`という記法があります';
    expect(convertMarkdownToSlackMrkdwn(md)).toBe('`**not bold**`という記法があります');
  });

  it('&, <, > をエスケープする(Slackのリンク/メンション記法との衝突を防ぐ)', () => {
    expect(convertMarkdownToSlackMrkdwn('A < B && B > C')).toBe('A &lt; B &amp;&amp; B &gt; C');
  });

  it('生成したリンク記法<url|text>自体はエスケープで壊れない', () => {
    const result = convertMarkdownToSlackMrkdwn('[example](https://example.com/a?x=1&y=2)');
    expect(result).toBe('<https://example.com/a?x=1&amp;y=2|example>');
  });

  it('空文字列を渡しても例外にならない', () => {
    expect(convertMarkdownToSlackMrkdwn('')).toBe('');
  });

  it('フェンス(```)が閉じられていない(応答が途中で打ち切られた等)場合は末尾に閉じ用の```を補う', () => {
    const md = '以下のコードです。\n```js\nfunction foo() {\n  return 1;';
    const result = convertMarkdownToSlackMrkdwn(md);
    const fenceCount = (result.match(/```/g) ?? []).length;
    expect(fenceCount % 2).toBe(0);
    expect(result).toContain('```js\nfunction foo() {\n  return 1;\n```');
  });

  it('フェンスが正しく閉じられている場合は余分な```を追加しない', () => {
    const md = '```js\nconsole.log(1)\n```';
    const result = convertMarkdownToSlackMrkdwn(md);
    const fenceCount = (result.match(/```/g) ?? []).length;
    expect(fenceCount).toBe(2);
  });

  it('複合的なMarkdown文書を一通り変換できる', () => {
    const md = [
      '## 結論',
      '',
      '**重要**なポイントは以下の通りです。',
      '',
      '- 1つ目の理由',
      '- 2つ目の理由',
      '',
      '詳細は[ドキュメント](https://example.com/docs)を参照してください。',
      '',
      '```js',
      'console.log("hello")',
      '```',
    ].join('\n');
    const result = convertMarkdownToSlackMrkdwn(md);
    expect(result).toContain('*結論*');
    expect(result).toContain('*重要*なポイントは以下の通りです。');
    expect(result).toContain('• 1つ目の理由');
    expect(result).toContain('• 2つ目の理由');
    expect(result).toContain('<https://example.com/docs|ドキュメント>');
    expect(result).toContain('```js\nconsole.log("hello")\n```');
  });
});
