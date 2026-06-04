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

  it('閉じタグのない不完全な think ブロックを除去する（max_tokens 枯渇ケース）', () => {
    const input = '<think>max_tokens 上限で切れた思考の途中...';
    expect(stripThinkTags(input)).toBe('');
  });

  it('不完全な think ブロックの後に続くテキストもすべて除去する', () => {
    const input = '<think>思考中\n途中で切れてしまった内容がここに延々と続く';
    expect(stripThinkTags(input)).toBe('');
  });

  it('完全な think ブロックの後に不完全な think ブロックが続く場合も処理する', () => {
    const input = '<think>完全</think>中間テキスト<think>未完了';
    expect(stripThinkTags(input)).toBe('中間テキスト');
  });
});
