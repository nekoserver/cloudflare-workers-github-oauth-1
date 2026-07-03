import { describe, it, expect } from 'vitest';
import { validateFreeText, buildFreeTextSlackMessage } from './freeTextSlackPost';

describe('validateFreeText', () => {
  it('通常の文字列を受け付ける', () => {
    const result = validateFreeText('こんにちは');
    expect(result).toEqual({ ok: true, text: 'こんにちは' });
  });

  it('前後の空白をトリムする', () => {
    const result = validateFreeText('  hello  ');
    expect(result).toEqual({ ok: true, text: 'hello' });
  });

  it('空文字列を拒否する', () => {
    const result = validateFreeText('');
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('空');
  });

  it('空白のみの文字列を拒否する', () => {
    const result = validateFreeText('   \n\t  ');
    expect(result.ok).toBe(false);
  });

  it('文字列以外の入力を拒否する（戻り値が空文字やnullにならないことを保証）', () => {
    expect(validateFreeText(undefined).ok).toBe(false);
    expect(validateFreeText(null).ok).toBe(false);
    expect(validateFreeText(123).ok).toBe(false);
    expect(validateFreeText({}).ok).toBe(false);
  });

  it('3000文字を超える本文を拒否する', () => {
    const longText = 'あ'.repeat(3001);
    const result = validateFreeText(longText);
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toContain('長すぎます');
  });

  it('ちょうど3000文字は許可する', () => {
    const text = 'あ'.repeat(3000);
    const result = validateFreeText(text);
    expect(result).toEqual({ ok: true, text });
  });
});

describe('buildFreeTextSlackMessage', () => {
  it('表示名と本文を含むSlackメッセージを組み立てる', () => {
    const msg = buildFreeTextSlackMessage('octocat', 'テスト投稿です');
    expect(msg).toContain('octocat');
    expect(msg).toContain('テスト投稿です');
  });
});
