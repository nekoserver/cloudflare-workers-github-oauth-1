import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const view = readFileSync(new URL('./views/heritageAccess.ts', import.meta.url).pathname, 'utf-8');

describe('世界遺産名リンク — acc-name-link クリックでチャットログモーダルを開く', () => {
  it('checkHeritageKeywords で生成する acc-name-link ボタンのクリックで openHeritageChatlogModal を呼ぶ', () => {
    const fnIdx = view.indexOf('function checkHeritageKeywords(');
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

describe('世界遺産名リンク — check-heritage-questions-batch は kwCheckPromise 完了後に実行', () => {
  it('openAccordion 内で check-heritage-questions-batch fetch が kwCheckPromise.then の中にある', () => {
    const fnIdx = view.indexOf('function openAccordion(');
    const fnBlock = view.slice(fnIdx, fnIdx + 4000);
    const batchIdx = fnBlock.indexOf('check-heritage-questions-batch');
    expect(batchIdx).toBeGreaterThan(-1);
    const beforeBatch = fnBlock.slice(0, batchIdx);
    const lastKwPromiseThen = beforeBatch.lastIndexOf('kwCheckPromise.then');
    expect(lastKwPromiseThen).toBeGreaterThan(-1);
    const lastKwPromise = beforeBatch.lastIndexOf('kwCheckPromise');
    expect(lastKwPromise).toEqual(lastKwPromiseThen);
  });

  it('openAccordion 内で check-heritage-questions-batch が kwCheckPromise 完了前に fetch されていない', () => {
    const fnIdx = view.indexOf('function openAccordion(');
    const fnBlock = view.slice(fnIdx, fnIdx + 4000);
    const firstKwPromise = fnBlock.indexOf('var kwCheckPromise');
    const firstBatch = fnBlock.indexOf('check-heritage-questions-batch');
    const firstKwThen = fnBlock.indexOf('kwCheckPromise.then');
    expect(firstKwThen).toBeLessThan(firstBatch);
    expect(firstKwPromise).toBeLessThan(firstKwThen);
  });
});
