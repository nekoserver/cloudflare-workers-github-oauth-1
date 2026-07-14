import { describe, expect, it } from 'vitest';
import { HERITAGE_LIST } from './data/heritageList';
import { findHeritageAreaPoint } from './index';

// 対象: unresolved_castle_keywords に記録されていた28件の「(カタカナ)城」候補のうち、
// 実在を確認でき、既存のUNESCO世界遺産(複合名)エントリの一部と判明した19件を
// 既存エントリと同一座標のエイリアスとして、既存エントリに含まれない6件を
// 新規世界遺産(未登録)として、それぞれHERITAGE_LISTへ追加した分の回帰テスト。
//
// 重要: findHeritageAreaPointは完全一致検索のため、HERITAGE_LISTのnには
// unresolved_castle_keywords.castle_nameに記録された「素の」キーワード文字列
// (例:「ハイデルベルク城」)をそのまま使う必要がある。過去に誤って
// 「ヨーロッパの」「アルジェリアの」等の地域名を冠して登録してしまい、
// 実際のキーワードと文字列が一致せず1件も解決できていなかった不具合があった
// ため、この回帰を防ぐテストを含む。
//
// 「モンテビアンコ城」は当初「モンテ・ビアンコ(モンブラン)」との混同を疑い保留したが、
// ユーザーからの追加情報(スイス・ティチーノ州、サッソ・コルバーロ城やカステルグランデと
// 同じベリンツォーナに所在)により、ベリンツォーナの3城塞のうちの1つ(モンテベッロ城の
// 表記ゆれ)と判明したため、既存の「ベリンツォーナの3城塞・城壁と防壁」と同一座標の
// エイリアスとして追加する。
// 「コンスタンティーヌ城」はアルジェリアのコンスタンティーヌ市と誤認して一度追加したが、
// ユーザーから実際はフランス・カルカッソンヌにある城との訂正を受けたため削除し、
// 誤った追加はしない(正しい実体の追加は別途調査するまで保留)。
// 「アル・カリス城」もアフリカに関係しそうだがユーザーの指示により確定を保留し、追加しない。
// なおモーゼルブルク城も含め、これら3件は実在する特定の城として確認できなかった/
// 保留のため追加を見送り、unresolved_castle_keywordsに残したまま未解決とする。
describe('HERITAGE_LIST: unresolved_castle_keywords由来の城名(既存複合名エントリのエイリアス19件、素のキーワード名で登録)', () => {
  const byName = (n: string) => HERITAGE_LIST.find((h) => h.n === n);

  it('各城は素のキーワード名(地域名を冠さない)で、対応する既存の複合名UNESCO登録と同一の国旗・登録年・座標を持つ', () => {
    expect(byName('ブダ城')).toMatchObject({ f: '🇭🇺', y: 1987, lat: 47.50, lon: 19.04 });
    expect(byName('ホーエンザルツブルク城')).toMatchObject({ f: '🇦🇹', y: 1996, lat: 47.80, lon: 13.04 });
    expect(byName('ダラム城')).toMatchObject({ f: '🇬🇧', y: 1986, lat: 54.78, lon: -1.58 });
    expect(byName('エッゲンベルク城')).toMatchObject({ f: '🇦🇹', y: 1999, lat: 47.07, lon: 15.44 });
    expect(byName('アウグストゥスブルク城')).toMatchObject({ f: '🇩🇪', y: 1984, lat: 50.82, lon: 6.91 });
    expect(byName('ファルケンルスト城')).toMatchObject({ f: '🇩🇪', y: 1984, lat: 50.82, lon: 6.91 });
    expect(byName('サッソ・コルバーロ城')).toMatchObject({ f: '🇨🇭', y: 2000, lat: 46.20, lon: 9.03 });
    expect(byName('モンテビアンコ城')).toMatchObject({ f: '🇨🇭', y: 2000, lat: 46.20, lon: 9.03 });
    expect(byName('ムスカウアー城')).toMatchObject({ f: '🇩🇪', y: 2004, lat: 51.57, lon: 14.97 });
    expect(byName('ワヴェル城')).toMatchObject({ f: '🇵🇱', y: 1978, lat: 50.06, lon: 19.94 });
    expect(byName('シギショアラ城')).toMatchObject({ f: '🇷🇴', y: 1999, lat: 46.22, lon: 24.79 });
    expect(byName('ベルヴェデーレ城')).toMatchObject({ f: '🇦🇹', y: 2001, lat: 48.21, lon: 16.37 });
    expect(byName('ワイマール城')).toMatchObject({ f: '🇩🇪', y: 1998, lat: 50.98, lon: 11.33 });
    expect(byName('エステンセ城')).toMatchObject({ f: '🇮🇹', y: 1995, lat: 44.84, lon: 11.62 });
    expect(byName('ヴィルヘルムスヘーエ城')).toMatchObject({ f: '🇩🇪', y: 2013, lat: 51.31, lon: 9.42 });
    expect(byName('クエンカ城')).toMatchObject({ f: '🇪🇸', y: 1996, lat: 40.07, lon: -2.13 });
  });

  it('ノイシュヴァンシュタイン城・ネシュヴェンシュタイン城(表記ゆれ・同一の城)・リンダーホーフ城は3件とも「ルートヴィヒ2世のバイエルン宮殿群」と同一座標', () => {
    const expected = { f: '🇩🇪', y: 2025, lat: 47.56, lon: 10.75 };
    expect(byName('ノイシュヴァンシュタイン城')).toMatchObject(expected);
    expect(byName('ネシュヴェンシュタイン城')).toMatchObject(expected);
    expect(byName('リンダーホーフ城')).toMatchObject(expected);
  });

  it('地域名を冠した誤った表記(ヨーロッパの◯◯城)はもはや登録されていない(過去の不具合の再発防止)', () => {
    expect(byName('ヨーロッパのブダ城')).toBeUndefined();
    expect(byName('ヨーロッパのワヴェル城')).toBeUndefined();
    expect(byName('ヨーロッパのハイデルベルク城')).toBeUndefined();
  });

  it('findHeritageAreaPointがunresolved_castle_keywordsに実際に記録された素のキーワード文字列で解決できる(回帰防止・代表4件)', () => {
    const wavel = findHeritageAreaPoint('ワヴェル城');
    expect(wavel).not.toBeNull();
    expect(wavel!.flag).toBe('🇵🇱');
    const heidelberg = findHeritageAreaPoint('ハイデルベルク城');
    expect(heidelberg).not.toBeNull();
    expect(heidelberg!.flag).toBe('🇩🇪');
    const neuschwanstein = findHeritageAreaPoint('ノイシュヴァンシュタイン城');
    expect(neuschwanstein).not.toBeNull();
    expect(neuschwanstein!.flag).toBe('🇩🇪');
    const budaCastle = findHeritageAreaPoint('ブダ城');
    expect(budaCastle).not.toBeNull();
    expect(budaCastle!.flag).toBe('🇭🇺');
  });
});

describe('HERITAGE_LIST: unresolved_castle_keywords由来の新規(未登録扱い含む)城6件(素のキーワード名で登録)', () => {
  const byName = (n: string) => HERITAGE_LIST.find((h) => h.n === n);

  it('UNESCO未登録の城は素のキーワード名・y:"----"で登録され、国旗・座標が設定されている', () => {
    expect(byName('エステ城')).toMatchObject({ f: '🇮🇹', y: '----' });
    expect(byName('サン・ジョルジョ城')).toMatchObject({ f: '🇵🇹', y: '----' });
    expect(byName('レーゲンベルク城')).toMatchObject({ f: '🇨🇭', y: '----' });
    expect(byName('シャウエンブルク城')).toMatchObject({ f: '🇩🇪', y: '----' });
    expect(byName('ヴィルヘルムスブルク城')).toMatchObject({ f: '🇩🇪', y: '----' });
    expect(byName('ハイデルベルク城')).toMatchObject({ f: '🇩🇪', y: '----' });
  });

  it('各新規エントリは有効な緯度経度(数値かつ範囲内)を持つ', () => {
    const names = [
      'エステ城',
      'サン・ジョルジョ城',
      'レーゲンベルク城',
      'シャウエンブルク城',
      'ヴィルヘルムスブルク城',
      'ハイデルベルク城',
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

describe('HERITAGE_LIST: 実在確認できなかった/保留とした3件は追加を見送る', () => {
  it('「モーゼルブルク城」はいずれの表記でもHERITAGE_LISTに追加されていない(調査で実在確認できなかったため)', () => {
    expect(HERITAGE_LIST.find((h) => h.n.includes('モーゼルブルク城'))).toBeUndefined();
  });

  it('「コンスタンティーヌ城」はいずれの表記でもHERITAGE_LISTに追加されていない(アルジェリアと誤認していたため削除。実際はフランス・カルカッソンヌ)', () => {
    expect(HERITAGE_LIST.find((h) => h.n.includes('コンスタンティーヌ城'))).toBeUndefined();
  });

  it('「アル・カリス城」はいずれの表記でもHERITAGE_LISTに追加されていない(所属地域の確定をユーザーの指示により保留)', () => {
    expect(HERITAGE_LIST.find((h) => h.n.includes('アル・カリス城'))).toBeUndefined();
  });
});
