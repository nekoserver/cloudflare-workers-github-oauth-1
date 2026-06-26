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
  it('openAccordion 内で check-heritage-questions-batch fetch が checkHeritageKeywords の .then() の中にある', () => {
    const fnIdx = view.indexOf('function openAccordion(');
    const fnBlock = view.slice(fnIdx, fnIdx + 4000);
    const batchIdx = fnBlock.indexOf('check-heritage-questions-batch');
    expect(batchIdx).toBeGreaterThan(-1);
    const beforeBatch = fnBlock.slice(0, batchIdx);
    // checkHeritageKeywords(...).then( が batch より前にある
    const kwThenIdx = beforeBatch.lastIndexOf('checkHeritageKeywords(filtered, inner).then(');
    expect(kwThenIdx).toBeGreaterThan(-1);
  });

  it('openAccordion 内で kwCheckPromise は checkHeritageKeywords(...).then() で初期化される', () => {
    const fnIdx = view.indexOf('function openAccordion(');
    const fnBlock = view.slice(fnIdx, fnIdx + 4000);
    const kwPromiseIdx = fnBlock.indexOf('var kwCheckPromise');
    expect(kwPromiseIdx).toBeGreaterThan(-1);
    // kwCheckPromise の初期化に checkHeritageKeywords が含まれる
    const initLine = fnBlock.slice(kwPromiseIdx, kwPromiseIdx + 120);
    expect(initLine).toContain('checkHeritageKeywords(filtered, inner).then(');
  });
});
