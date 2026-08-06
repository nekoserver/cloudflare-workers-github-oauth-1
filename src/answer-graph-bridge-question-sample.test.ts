import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { getAnswerGraphPage } from './views/answerGraph';

describe('/answer-graph: 起点と終点をつなぐ補足質問サンプル', () => {
  const html = getAnswerGraphPage('testuser');

  it('起点・終点と3種類の補足質問を表示する', () => {
    const dom = new JSDOM(html);
    const sample = dom.window.document.querySelector('#bridgeQuestionSample');

    expect(sample).not.toBeNull();
    expect(sample?.textContent).toContain('起点 Q/A');
    expect(sample?.textContent).toContain('終点 Q/A');
    expect(sample?.textContent).toContain('補足質問 1: 前提');
    expect(sample?.textContent).toContain('補足質問 2: 脅威');
    expect(sample?.textContent).toContain('補足質問 3: 接続原理');
    expect(sample?.querySelectorAll('[data-search-keyword]')).toHaveLength(3);
  });

  it('探索ボタンを通常の検索・パン屑ループへ接続する', () => {
    expect(html).toContain("bridgeQuestionSample.addEventListener('click'");
    expect(html).toContain("button.getAttribute('data-search-keyword')");
    expect(html).toContain('pushTrailKeyword(keyword)');
    expect(html).toContain('doSeedSearch(keyword)');
  });
});
