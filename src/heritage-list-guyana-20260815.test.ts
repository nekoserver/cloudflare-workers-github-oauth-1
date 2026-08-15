import { describe, it, expect } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: 世界遺産ページ(HERITAGE_LIST)のガイアナの項目。
// ガイアナは2026年時点でUNESCO世界遺産(正式登録)はゼロで、暫定リストの
// 資産のみが存在する(2001年にカイエトゥール国立公園のノミネーションが
// 取り下げられて以降、正式登録は一件もない)。既存の「カイエトゥール国立公園」の
// 登録年y:2024は誤りだったため未登録(y:'----')に修正し、暫定リストに掲載されている
// 他4件+シェル・ビーチを追加した。
//
// 故障シナリオ:
//   (1) 実際には未登録のカイエトゥール国立公園をy:2024(登録済み)のまま
//       放置してしまう
//   (2) 暫定リストの資産をUNESCO正式登録扱い(数値のy)で追加してしまう
//   (3) 既存のカイエトゥール国立公園の座標・データを重複追加してしまう

describe('世界遺産リスト: ガイアナ', () => {
  const guyana = HERITAGE_LIST.filter((h) => h.c === 'ガイアナ');

  it('ガイアナのUNESCO正式登録サイトは0件(すべて未登録y:----)', () => {
    const registered = guyana.filter((h) => h.y !== '----');
    expect(registered).toHaveLength(0);
  });

  it('カイエトゥール国立公園は未登録(y:----)に修正されている(実際には2001年にノミネーションが取り下げられ現在も未登録)', () => {
    const entries = guyana.filter((h) => h.n.includes('カイエトゥール'));
    expect(entries).toHaveLength(1);
    expect(entries[0].y).toBe('----');
    expect(entries[0].lat).toBeCloseTo(5.18, 1);
    expect(entries[0].lon).toBeCloseTo(-59.48, 1);
  });

  it('セント・ジョージ大聖堂が座標付きで追加されている', () => {
    const entry = guyana.find((h) => h.n.includes('セント・ジョージ'));
    expect(entry).toBeDefined();
    expect(entry!.y).toBe('----');
    expect(entry!.lat).toBeCloseTo(6.81, 1);
    expect(entry!.lon).toBeCloseTo(-58.16, 1);
  });

  it('ゼーラント要塞(フォート・アイランド)が座標付きで追加されている', () => {
    const entry = guyana.find((h) => h.n.includes('ゼーラント要塞'));
    expect(entry).toBeDefined();
    expect(entry!.y).toBe('----');
    expect(entry!.lat).toBeCloseTo(6.78, 1);
    expect(entry!.lon).toBeCloseTo(-58.52, 1);
  });

  it('ジョージタウン市庁舎が座標付きで追加されている', () => {
    const entry = guyana.find((h) => h.n.includes('市庁舎'));
    expect(entry).toBeDefined();
    expect(entry!.y).toBe('----');
    expect(entry!.lat).toBeCloseTo(6.81, 1);
    expect(entry!.lon).toBeCloseTo(-58.17, 1);
  });

  it('ジョージタウンのプランテーション構造と歴史的建造物群が座標付きで追加されている', () => {
    const entry = guyana.find((h) => h.n.includes('プランテーション構造'));
    expect(entry).toBeDefined();
    expect(entry!.y).toBe('----');
    expect(entry!.lat).toBeCloseTo(6.80, 1);
    expect(entry!.lon).toBeCloseTo(-58.16, 1);
  });

  it('シェル・ビーチ(エセキボ海岸)が座標付きで追加されている', () => {
    const entry = guyana.find((h) => h.n.includes('シェル・ビーチ'));
    expect(entry).toBeDefined();
    expect(entry!.t).toBe('自然遺産');
    expect(entry!.y).toBe('----');
    expect(entry!.lat).toBeCloseTo(8.29, 1);
    expect(entry!.lon).toBeCloseTo(-59.56, 1);
  });

  it('ガイアナの項目は合計6件になっている(カイエトゥール既存1件+新規5件)', () => {
    expect(guyana).toHaveLength(6);
  });

  it('国旗絵文字はすべて🇬🇾で統一されている', () => {
    expect(guyana.every((h) => h.f === '🇬🇾')).toBe(true);
  });
});
