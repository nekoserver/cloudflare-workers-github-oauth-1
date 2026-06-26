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

describe('世界遺産名リンク — 質問バッジ処理はキーワード処理と分離し個別ループで適用', () => {
  it('checkHeritageKeywords 内では check-heritage-questions-batch を実行しない（キーワード処理と衝突させない）', () => {
    const fnIdx = view.indexOf('function checkHeritageKeywords(');
    const fnEnd = view.indexOf('function applyQuestionBadges(');
    const fnBlock = view.slice(fnIdx, fnEnd);
    expect(fnBlock).not.toContain('check-heritage-questions-batch');
  });

  it('applyQuestionBadges 関数が定義され check-heritage-questions-batch を呼ぶ', () => {
    const fnIdx = view.indexOf('function applyQuestionBadges(');
    expect(fnIdx).toBeGreaterThan(-1);
    const fnBlock = view.slice(fnIdx, fnIdx + 2000);
    expect(fnBlock).toContain('check-heritage-questions-batch');
  });

  it('applyQuestionBadges は全世界遺産名のループ内で個別に質問バッジを適用する', () => {
    const fnIdx = view.indexOf('function applyQuestionBadges(');
    const fnBlock = view.slice(fnIdx, fnIdx + 2000);
    expect(fnBlock).toContain('names.forEach');
    expect(fnBlock).toContain('ensureTopicBadge(inner, name, t)');
  });

  it('openAccordion は checkHeritageKeywords 完了後に applyQuestionBadges を呼ぶ（衝突回避）', () => {
    const fnIdx = view.indexOf('function openAccordion(');
    const fnBlock = view.slice(fnIdx, fnIdx + 5000);
    expect(fnBlock).toContain('checkHeritageKeywords(filtered, inner).then(');
    expect(fnBlock).toContain('applyQuestionBadges(inner, heritageNames)');
  });
});
