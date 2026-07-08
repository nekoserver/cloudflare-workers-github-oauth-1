import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

describe('HERITAGE_LIST — ケニア世界遺産', () => {
  // 登録年が '----'(表示上は「----年」)のエントリは UNESCO 世界遺産ではなく、
  // 意図的に登録された例外的なデータ(ンゴング競馬場など)として扱う。
  // 今後も同様の例外を追加する場合は y に '----' を設定することで
  // 世界遺産件数の集計から除外される。
  const isUnescoHeritage = (item: { y: number | '----' }) => item.y !== '----';

  it('UNESCO世界遺産リスト掲載のケニア8件をすべて含む', () => {
    const kenyaHeritage = HERITAGE_LIST.filter((item) => item.c === 'ケニア' && isUnescoHeritage(item));
    const names = kenyaHeritage.map((item) => item.n);

    expect(names).toEqual(expect.arrayContaining([
      'ケニヤ山国立公園',
      'トゥルカナ湖国立公園群',
      'ラム旧市街',
      'ミジケンダのカヤの森',
      'ケニア・グレート・リフト・バレーの湖群',
      'フォート・ジーザス（モンバサ）',
      'ティムリカ・オヒンガ考古遺跡',
      'ゲディの歴史都市と考古遺跡',
    ]));
    expect(kenyaHeritage).toHaveLength(8);
  });

  it('ケニア世界遺産の座標がすべて設定されている', () => {
    const kenyaHeritage = HERITAGE_LIST.filter((item) => item.c === 'ケニア' && isUnescoHeritage(item));

    expect(kenyaHeritage.length).toBeGreaterThan(0);
    for (const item of kenyaHeritage) {
      expect(Number.isFinite(item.lat)).toBe(true);
      expect(Number.isFinite(item.lon)).toBe(true);
    }
  });

  it('ンゴング競馬場は世界遺産ではない例外データとして登録年が「----」になっている', () => {
    const ngong = HERITAGE_LIST.find((item) => item.n === 'ンゴング競馬場');
    expect(ngong).toBeDefined();
    expect(ngong!.y).toBe('----');
  });
});
