import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: src/data/heritageList.ts のHeritageItem.md(登録月日, 'MM-DD'形式)フィールド。
// UNESCO世界遺産委員会は年1回のセッションで登録を決定するため、同一年に登録された
// 資産は同じセッション最終日を代表日として共有できる。「今週の世界遺産」機能で
// アクセス日+7日が制定日となる資産を検索するために、主要な世界遺産のみ実際の
// セッション最終日(または個別確認済みの登録日)を調査して設定している。
describe('heritageList: 主要世界遺産のmd(登録月日)フィールド', () => {
  const byName = (n: string) => HERITAGE_LIST.find((h) => h.n === n);

  it('md形式は全件 MM-DD (2桁-2桁) である', () => {
    const withMd = HERITAGE_LIST.filter((h) => h.md !== undefined);
    expect(withMd.length).toBeGreaterThanOrEqual(27);
    for (const h of withMd) {
      expect(h.md).toMatch(/^\d{2}-\d{2}$/);
    }
  });

  it('1987年セッション(第11回パリ, 12/7-11)の資産は md:12-11', () => {
    expect(byName('万里の長城')?.md).toBe('12-11');
    expect(byName('故宮（北京）')?.md).toBe('12-11');
    expect(byName('兵馬俑')?.md).toBe('12-11');
  });

  it('1993年セッション(第17回カルタヘナ, 12/6-11)の資産は md:12-11', () => {
    expect(byName('法隆寺地域の仏教建造物群')?.md).toBe('12-11');
    expect(byName('屋久島')?.md).toBe('12-11');
    expect(byName('姫路城')?.md).toBe('12-11');
    expect(byName('白神山地')?.md).toBe('12-11');
  });

  it('2005年セッション(第29回ダーバン, 7/10-17)の知床は md:07-17', () => {
    expect(byName('知床')?.md).toBe('07-17');
  });

  it('2011年セッション(第35回パリ, 6/19-29)の資産は md:06-29', () => {
    expect(byName('小笠原諸島')?.md).toBe('06-29');
    expect(byName('平泉')?.md).toBe('06-29');
  });

  it('2013年セッション(第37回プノンペン, 6/16-27)の資産は md:06-27', () => {
    expect(byName('富士山')?.md).toBe('06-27');
    expect(byName('モンテ・エトナ')?.md).toBe('06-27');
    expect(byName('トスカーナのメディチ家別荘群と庭園群')?.md).toBe('06-27');
  });

  it('個別確認済みの日付(2023年・2025年のイタリア資産)', () => {
    expect(byName('北アペニン山脈の石膏カルストと洞窟群')?.md).toBe('09-19');
    expect(byName('サルデーニャ先史時代の葬送伝統－ドムス・デ・ジャナス')?.md).toBe('07-12');
  });

  it('md未設定の資産(マイナー・年不明な資産)は md が undefined のままである', () => {
    expect(byName('奄美大島・徳之島・西表島')?.md).toBeUndefined();
    expect(byName('紀伊山地の霊場と参詣道')?.md).toBeUndefined();
  });
});
