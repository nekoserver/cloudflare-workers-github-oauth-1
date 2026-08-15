import { describe, it, expect } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';

// 対象: 世界遺産ページ(HERITAGE_LIST)のスリナムの項目。
// スリナムは2026年時点でUNESCO世界遺産(正式登録)が3件、暫定リスト掲載は
// 0件であることをWebSearchで確認した。既存データにはセントラル・スリナム
// 自然保護区(2000年)とパラマリボの歴史地区(2002年)のみ登録されており、
// 2023年に新規登録されたジョーデンサバンナ考古学遺跡が不足していたため追加した。
//
// 故障シナリオ:
//   (1) 既存2件を重複して追加してしまう
//   (2) ジョーデンサバンナの座標を誤って設定する
//   (3) 実在しない暫定リスト資産を未登録扱いで追加してしまう(スリナムの
//       暫定リストは現在0件)

describe('世界遺産リスト: スリナム', () => {
  const suriname = HERITAGE_LIST.filter((h) => h.c === 'スリナム');

  it('スリナムのUNESCO正式登録サイトは3件', () => {
    const registered = suriname.filter((h) => h.y !== '----');
    expect(registered).toHaveLength(3);
  });

  it('既存のセントラル・スリナム自然保護区・パラマリボの歴史地区は維持されている(重複追加していない)', () => {
    const centralSuriname = suriname.filter((h) => h.n.includes('セントラル・スリナム'));
    const paramaribo = suriname.filter((h) => h.n.includes('パラマリボ'));
    expect(centralSuriname).toHaveLength(1);
    expect(paramaribo).toHaveLength(1);
    expect(centralSuriname[0].y).toBe(2000);
    expect(paramaribo[0].y).toBe(2002);
  });

  it('ジョーデンサバンナ考古学遺跡が2023年登録・座標付きで追加されている', () => {
    const entry = suriname.find((h) => h.n.includes('ジョーデンサバンナ'));
    expect(entry).toBeDefined();
    expect(entry!.t).toBe('文化遺産');
    expect(entry!.y).toBe(2023);
    expect(entry!.lat).toBeCloseTo(5.43, 1);
    expect(entry!.lon).toBeCloseTo(-54.98, 1);
  });

  it('スリナムの項目は合計3件になっている', () => {
    expect(suriname).toHaveLength(3);
  });

  it('国旗絵文字はすべて🇸🇷で統一されている', () => {
    expect(suriname.every((h) => h.f === '🇸🇷')).toBe(true);
  });
});
