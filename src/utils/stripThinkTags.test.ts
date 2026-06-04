import { describe, it, expect } from 'vitest';
import { stripThinkTags } from './stripThinkTags';

describe('stripThinkTags', () => {
  it('think タグとその内容を除去する', () => {
    const input = '<think>内部推論テキスト</think>実際の回答';
    expect(stripThinkTags(input)).toBe('実際の回答');
  });

  it('think タグがない場合はそのまま返す', () => {
    const input = 'こんにちは、何かお手伝いできますか？';
    expect(stripThinkTags(input)).toBe(input);
  });

  it('複数の think タグを除去する', () => {
    const input = '<think>第一思考</think>回答その1<think>第二思考</think>回答その2';
    expect(stripThinkTags(input)).toBe('回答その1回答その2');
  });

  it('think タグが改行を含む場合も除去する', () => {
    const input = '<think>\nステップ1\nステップ2\n</think>\n最終回答';
    expect(stripThinkTags(input)).toBe('最終回答');
  });

  it('空文字列を渡すと空文字列を返す', () => {
    expect(stripThinkTags('')).toBe('');
  });

  it('think タグのみの場合は空文字列を返す（応答なし判定に使う）', () => {
    const input = '<think>全部思考で終わった</think>';
    expect(stripThinkTags(input)).toBe('');
  });

  it('前後の空白をトリムする', () => {
    const input = '  <think>推論</think>  回答  ';
    expect(stripThinkTags(input)).toBe('回答');
  });
});
