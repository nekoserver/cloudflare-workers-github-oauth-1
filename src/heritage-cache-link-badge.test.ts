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

describe('世界遺産名リンク — check-heritage-questions-batch は checkHeritageKeywords 内で実行', () => {
  it('checkHeritageKeywords 内で check-heritage-questions-batch fetch が呼ばれる', () => {
    const fnIdx = view.indexOf('function checkHeritageKeywords(');
    const fnBlock = view.slice(fnIdx, fnIdx + 8000);
    expect(fnBlock).toContain('check-heritage-questions-batch');
  });

  it('openAccordion は checkHeritageKeywords を直接呼ぶだけ（バッチは checkHeritageKeywords 内に統合済み）', () => {
    const fnIdx = view.indexOf('function openAccordion(');
    const fnBlock = view.slice(fnIdx, fnIdx + 5000);
    expect(fnBlock).toContain('checkHeritageKeywords(filtered, inner)');
    expect(fnBlock).not.toContain('check-heritage-questions-batch');
  });
});
