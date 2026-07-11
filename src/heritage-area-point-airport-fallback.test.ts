import { describe, it, expect } from 'vitest';
import { findHeritageAreaPoint, normalizeHeritageAreaName } from './index';

// 対象: heritage-areaページのキーワードボタン国旗表示・距離順ソートが参照する
// findHeritageAreaPoint。世界遺産名だけでなく、AIチャット検索キーワードに
// 大量に含まれる「〇〇空港」も座標・国旗を引けるようにする。
describe('findHeritageAreaPoint — 世界遺産名 + 空港名の座標・国旗フォールバック', () => {
  it('世界遺産名(完全一致)は従来どおりHERITAGE_LISTから座標・国旗を引ける', () => {
    const point = findHeritageAreaPoint('姫路城');
    expect(point).not.toBeNull();
    expect(point!.flag).toBe('🇯🇵');
    expect(point!.lat).toBeCloseTo(34.84, 1);
  });

  it('世界遺産に無いキーワードは空港名(AIRPORT_LIST)からフォールバックで座標・国旗を引ける', () => {
    const point = findHeritageAreaPoint('成田国際空港');
    expect(point).not.toBeNull();
    expect(point!.flag).toBe('🇯🇵');
    expect(point!.lat).toBeCloseTo(35.77, 1);
    expect(point!.lon).toBeCloseTo(140.39, 1);
  });

  it('今回追加した地方空港(ミュンヘン国際空港)もAIRPORT_LISTから引ける', () => {
    const point = findHeritageAreaPoint('ミュンヘン国際空港');
    expect(point).not.toBeNull();
    expect(point!.flag).toBe('🇩🇪');
    expect(point!.country).toBe('ドイツ・ミュンヘン');
  });

  it('中黒(全角・半角)の表記ゆれは正規化して同一視する', () => {
    const a = normalizeHeritageAreaName('サンクトペテルブルク･のような例');
    const b = normalizeHeritageAreaName('サンクトペテルブルク・のような例');
    expect(a).toBe(b);
  });

  it('世界遺産にも空港にも存在しないキーワードはnullを返す', () => {
    const point = findHeritageAreaPoint('存在しないキーワード12345');
    expect(point).toBeNull();
  });
});
