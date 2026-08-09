import { describe, it, expect } from 'vitest';
import { getFetchTextStreamDemoPage } from './fetchTextStreamDemo';

describe('getFetchTextStreamDemoPage', () => {
  it('TextDecoderStream を使ったサンプルコードを含むHTMLを返す', () => {
    const html = getFetchTextStreamDemoPage();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('TextDecoderStream');
    expect(html).toContain('fetchAsTextStream');
  });

  it('実行用のUI要素(入力欄・実行ボタン・出力欄)を含む', () => {
    const html = getFetchTextStreamDemoPage();
    expect(html).toContain('id="url-input"');
    expect(html).toContain('id="run-btn"');
    expect(html).toContain('id="output"');
  });
});
