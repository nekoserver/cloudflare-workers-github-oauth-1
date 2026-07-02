import { describe, it, expect } from 'vitest';
import { questionStartsWithHeritageBracket, findMatchingHeritageNames } from './heritageQuestionMatch';

describe('questionStartsWithHeritageBracket', () => {
  it('通常の世界遺産名で始まる質問文にマッチする', () => {
    const q = '「タージ・マハル」の「交通手段」について説明してください';
    expect(questionStartsWithHeritageBracket(q, 'タージ・マハル')).toBe(true);
  });

  it('世界遺産名自体に「」が入れ子で含まれていても正しくマッチする', () => {
    const heritageName = '「神宿る島」宗像・沖ノ島と関連遺産群';
    const q = '「' + heritageName + '」の「交通手段」について説明してください';
    expect(questionStartsWithHeritageBracket(q, heritageName)).toBe(true);
  });

  it('先頭が一致しない質問文にはマッチしない', () => {
    const q = 'タージ・マハルについて教えて';
    expect(questionStartsWithHeritageBracket(q, 'タージ・マハル')).toBe(false);
  });

  it('別の世界遺産名にはマッチしない', () => {
    const q = '「タージ・マハル」の「交通手段」について説明してください';
    expect(questionStartsWithHeritageBracket(q, '万里の長城')).toBe(false);
  });

  it('question または heritageName が空文字なら false を返す', () => {
    expect(questionStartsWithHeritageBracket('', 'タージ・マハル')).toBe(false);
    expect(questionStartsWithHeritageBracket('「タージ・マハル」の…', '')).toBe(false);
  });
});

describe('findMatchingHeritageNames', () => {
  it('入れ子括弧を含む世界遺産名を候補一覧から正しく特定する', () => {
    const heritageName = '「神宿る島」宗像・沖ノ島と関連遺産群';
    const q = '「' + heritageName + '」の「見どころ」について説明してください';
    const candidates = ['タージ・マハル', heritageName, '万里の長城'];
    expect(findMatchingHeritageNames(q, candidates)).toEqual([heritageName]);
  });

  it('一致する候補が無ければ空配列を返す', () => {
    const q = '「タージ・マハル」の「交通手段」について説明してください';
    expect(findMatchingHeritageNames(q, ['万里の長城', 'アクロポリス（アテネ）'])).toEqual([]);
  });

  it('旧ロジック(indexOfベース抽出)では取得できなかった名前が拾えることを確認する', () => {
    const heritageName = '「神宿る島」宗像・沖ノ島と関連遺産群';
    const q = '「' + heritageName + '」の「スポーツ施設」について説明してください';

    // 旧ロジック: 最初の「〜」区間を単純抽出（入れ子を考慮しない）
    const start = q.indexOf('「');
    const end = q.indexOf('」', start + 1);
    const legacyExtracted = q.slice(1, end);
    expect(legacyExtracted).not.toBe(heritageName); // 旧ロジックは途中で切れて一致しないことを再現

    // 新ロジック: 既知の世界遺産名と直接前方一致で比較するため正しく一致する
    expect(questionStartsWithHeritageBracket(q, heritageName)).toBe(true);
  });
});
