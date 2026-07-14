import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';
import { findHeritageAreaPoint } from './index';

// 対象: unresolved_castle_keywords に記録されていた28件の「(カタカナ)城」候補のうち、
// 実在を確認でき、既存のUNESCO世界遺産(複合名)エントリの一部と判明した20件を
// 既存エントリと同一座標のエイリアスとして、既存エントリに含まれない5件を
// 新規世界遺産(未登録)として、それぞれHERITAGE_LISTへ追加した分の回帰テスト。
// 「クエンカ城」はエクアドルの「クエンカ歴史地区」と紛らわしいため、
// ユーザー指示により地域名を冠して曖昧さを解消している(スペインの方はヨーロッパ、
// エクアドルはヨーロッパではないため区別できる)。
// 「モンテビアンコ城」は当初「モンテ・ビアンコ(モンブラン)」との混同を疑い保留したが、
// ユーザーからの追加情報(スイス・ティチーノ州、サッソ・コルバーロ城やカステルグランデと
// 同じベリンツォーナに所在)により、ベリンツォーナの3城塞のうちの1つ(モンテベッロ城の
// 表記ゆれ)と判明したため、既存の「ベリンツォーナの3城塞・城壁と防壁」と同一座標の
// エイリアスとして追加する。
// なお1件(モーゼルブルク城)は実在する特定の城として確認できなかったため
// 追加を見送り、unresolved_castle_keywordsに残したまま未解決とする。
describe('HERITAGE_LIST: unresolved_castle_keywords由来の城名(既存複合名エントリのエイリアス19件)', () => {
  const byName = (n: string) => HERITAGE_LIST.find((h) => h.n === n);

  it('ヨーロッパの各城は対応する既存の複合名UNESCO登録と同一の国旗・登録年・座標を持つ', () => {
    expect(byName('ヨーロッパのブダ城')).toMatchObject({ f: '🇭🇺', y: 1987, lat: 47.50, lon: 19.04 });
    expect(byName('ヨーロッパのホーエンザルツブルク城')).toMatchObject({ f: '🇦🇹', y: 1996, lat: 47.80, lon: 13.04 });
    expect(byName('ヨーロッパのダラム城')).toMatchObject({ f: '🇬🇧', y: 1986, lat: 54.78, lon: -1.58 });
    expect(byName('ヨーロッパのエッゲンベルク城')).toMatchObject({ f: '🇦🇹', y: 1999, lat: 47.07, lon: 15.44 });
    expect(byName('ヨーロッパのアウグストゥスブルク城')).toMatchObject({ f: '🇩🇪', y: 1984, lat: 50.82, lon: 6.91 });
    expect(byName('ヨーロッパのファルケンルスト城')).toMatchObject({ f: '🇩🇪', y: 1984, lat: 50.82, lon: 6.91 });
    expect(byName('ヨーロッパのサッソ・コルバーロ城')).toMatchObject({ f: '🇨🇭', y: 2000, lat: 46.20, lon: 9.03 });
    expect(byName('ヨーロッパのモンテビアンコ城')).toMatchObject({ f: '🇨🇭', y: 2000, lat: 46.20, lon: 9.03 });
    expect(byName('ヨーロッパのムスカウアー城')).toMatchObject({ f: '🇩🇪', y: 2004, lat: 51.57, lon: 14.97 });
    expect(byName('ヨーロッパのワヴェル城')).toMatchObject({ f: '🇵🇱', y: 1978, lat: 50.06, lon: 19.94 });
    expect(byName('ヨーロッパのシギショアラ城')).toMatchObject({ f: '🇷🇴', y: 1999, lat: 46.22, lon: 24.79 });
    expect(byName('ヨーロッパのベルヴェデーレ城')).toMatchObject({ f: '🇦🇹', y: 2001, lat: 48.21, lon: 16.37 });
    expect(byName('ヨーロッパのワイマール城')).toMatchObject({ f: '🇩🇪', y: 1998, lat: 50.98, lon: 11.33 });
    expect(byName('ヨーロッパのエステンセ城')).toMatchObject({ f: '🇮🇹', y: 1995, lat: 44.84, lon: 11.62 });
    expect(byName('ヨーロッパのヴィルヘルムスヘーエ城')).toMatchObject({ f: '🇩🇪', y: 2013, lat: 51.31, lon: 9.42 });
    expect(byName('ヨーロッパのクエンカ城')).toMatchObject({ f: '🇪🇸', y: 1996, lat: 40.07, lon: -2.13 });
  });

  it('ノイシュヴァンシュタイン城・ネシュヴェンシュタイン城(表記ゆれ・同一の城)・リンダーホーフ城は3件とも「ルートヴィヒ2世のバイエルン宮殿群」と同一座標', () => {
    const expected = { f: '🇩🇪', y: 2025, lat: 47.56, lon: 10.75 };
    expect(byName('ヨーロッパのノイシュヴァンシュタイン城')).toMatchObject(expected);
    expect(byName('ヨーロッパのネシュヴェンシュタイン城')).toMatchObject(expected);
    expect(byName('ヨーロッパのリンダーホーフ城')).toMatchObject(expected);
  });

  it('アルジェリアの「アル・カリス城」は既存の「ベニ・ハンマッドの城塞」と同一座標のエイリアス(アフリカのためヨーロッパのを冠さない)', () => {
    expect(byName('アルジェリアのアル・カリス城')).toMatchObject({ f: '🇩🇿', y: 1980, lat: 35.82, lon: 4.79 });
    expect(byName('ヨーロッパのアル・カリス城')).toBeUndefined();
  });

  it('findHeritageAreaPointでエイリアス名から国旗・座標を解決できる(統合テスト、代表2件)', () => {
    const p1 = findHeritageAreaPoint('ヨーロッパのワヴェル城');
    expect(p1).not.toBeNull();
    expect(p1!.flag).toBe('🇵🇱');
    const p2 = findHeritageAreaPoint('アルジェリアのアル・カリス城');
    expect(p2).not.toBeNull();
    expect(p2!.flag).toBe('🇩🇿');
  });
});

describe('HERITAGE_LIST: unresolved_castle_keywords由来の新規(未登録扱い含む)城5件', () => {
  const byName = (n: string) => HERITAGE_LIST.find((h) => h.n === n);

  it('UNESCO未登録の城はy:"----"で登録され、国旗・座標が設定されている', () => {
    expect(byName('ヨーロッパのエステ城')).toMatchObject({ f: '🇮🇹', y: '----' });
    expect(byName('ヨーロッパのサン・ジョルジョ城')).toMatchObject({ f: '🇵🇹', y: '----' });
    expect(byName('ヨーロッパのレーゲンベルク城')).toMatchObject({ f: '🇨🇭', y: '----' });
    expect(byName('ヨーロッパのシャウエンブルク城')).toMatchObject({ f: '🇩🇪', y: '----' });
    expect(byName('ヨーロッパのヴィルヘルムスブルク城')).toMatchObject({ f: '🇩🇪', y: '----' });
  });

  it('アルジェリアの「コンスタンティーヌ城」はUNESCO未登録・アフリカのためヨーロッパのを冠さない', () => {
    expect(byName('アルジェリアのコンスタンティーヌ城')).toMatchObject({ f: '🇩🇿', y: '----' });
    expect(byName('ヨーロッパのコンスタンティーヌ城')).toBeUndefined();
  });

  it('各新規エントリは有効な緯度経度(数値かつ範囲内)を持つ', () => {
    const names = [
      'ヨーロッパのエステ城',
      'ヨーロッパのサン・ジョルジョ城',
      'ヨーロッパのレーゲンベルク城',
      'アルジェリアのコンスタンティーヌ城',
      'ヨーロッパのシャウエンブルク城',
      'ヨーロッパのヴィルヘルムスブルク城',
    ];
    names.forEach((n) => {
      const item = byName(n);
      expect(item).toBeDefined();
      expect(Number.isFinite(item!.lat)).toBe(true);
      expect(Number.isFinite(item!.lon)).toBe(true);
      expect(item!.lat).toBeGreaterThan(-90);
      expect(item!.lat).toBeLessThan(90);
    });
  });
});

describe('HERITAGE_LIST: 実在確認できなかった1件は追加を見送る', () => {
  it('「モーゼルブルク城」はいずれの表記でもHERITAGE_LISTに追加されていない(調査で実在確認できなかったため)', () => {
    expect(HERITAGE_LIST.find((h) => h.n.includes('モーゼルブルク城'))).toBeUndefined();
  });
});
