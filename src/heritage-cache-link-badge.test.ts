import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const view = readFileSync(new URL('./views/heritageAccess.ts', import.meta.url).pathname, 'utf-8');

describe('世界遺産名リンク — acc-name-link クリックでチャットログモーダルを開く', () => {
  it('applyKeywordData で生成する acc-name-link ボタンのクリックで openHeritageChatlogModal を呼ぶ', () => {
    const fnIdx = view.indexOf('function applyKeywordData(');
    const fnBlock = view.slice(fnIdx, fnIdx + 3000);
    const btnIdx = fnBlock.indexOf("btn.addEventListener('click'");
    const btnBlock = fnBlock.slice(btnIdx, btnIdx + 200);
    expect(btnBlock).toContain('openHeritageChatlogModal');
  });

  it('ensureTopicBadge で生成する acc-name-link ボタンのクリックでも openHeritageChatlogModal を呼ぶ', () => {
    const fnIdx = view.indexOf('function ensureTopicBadge(');
    const fnBlock = view.slice(fnIdx, fnIdx + 2000);
    const btnIdx = fnBlock.indexOf("btn.addEventListener('click'");
    const btnBlock = fnBlock.slice(btnIdx, btnIdx + 200);
    expect(btnBlock).toContain('openHeritageChatlogModal');
  });
});

describe('世界遺産名リンク — fetchHeritageKeywordData と check-heritage-questions-batch の並列実行', () => {
  it('openAccordion 内で fetchHeritageKeywordData と check-heritage-questions-batch が Promise.all で並列実行される', () => {
    const fnIdx = view.indexOf('function openAccordion(');
    const fnBlock = view.slice(fnIdx, fnIdx + 4000);
    const promiseAllIdx = fnBlock.indexOf('Promise.all([');
    expect(promiseAllIdx).toBeGreaterThan(-1);
    const promiseBlock = fnBlock.slice(promiseAllIdx, promiseAllIdx + 600);
    expect(promiseBlock).toContain('fetchHeritageKeywordData');
    expect(promiseBlock).toContain('check-heritage-questions-batch');
  });

  it('openAccordion 内で cityCache にデータをセットしている', () => {
    const fnIdx = view.indexOf('function openAccordion(');
    const fnBlock = view.slice(fnIdx, fnIdx + 4000);
    expect(fnBlock).toContain('cityCache[cityName]');
    expect(fnBlock).toContain('heritages: filtered');
    expect(fnBlock).toContain('hits: kwData.hits');
  });
});
