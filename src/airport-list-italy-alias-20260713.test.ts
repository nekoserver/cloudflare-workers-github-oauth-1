import { describe, expect, it } from 'vitest';
import { AIRPORT_LIST } from './data/airports';
import { findHeritageAreaPoint } from './index';

// 対象: ユーザー指定の表記(ローマ・フィウミチーノ空港/ミラノ・リナーテ空港/ベネチア・テッセラ空港)が
// findHeritageAreaPointの完全一致検索で解決できるようにするためのAIRPORT_LISTエイリアス追加。
// ミラノ・リナーテ空港は既存データと完全一致するため追加不要、
// ローマ・フィウミチーノ空港(既存名: フィウミチーノ空港)とベネチア・テッセラ空港
// (既存名: ヴェネツィア・テッセラ空港)は表記ゆれのため同一座標のエイリアスを追加する。
describe('AIRPORT_LIST: イタリア空港のユーザー指定表記エイリアス', () => {
  const byName = (n: string) => AIRPORT_LIST.find((a) => a.name === n);

  it('ミラノ・リナーテ空港は既存データと完全一致し追加不要', () => {
    expect(byName('ミラノ・リナーテ空港')).toMatchObject({ code: 'LIN', lat: 45.4451, lon: 9.2767 });
  });

  it('ローマ・フィウミチーノ空港は既存のフィウミチーノ空港(FCO)と同じ座標のエイリアスとして登録されている', () => {
    const existing = byName('フィウミチーノ空港');
    expect(existing).toMatchObject({ code: 'FCO', lat: 41.8, lon: 12.25 });
    const alias = byName('ローマ・フィウミチーノ空港');
    expect(alias).toMatchObject({ code: 'FCO', lat: 41.8, lon: 12.25 });
  });

  it('ベネチア・テッセラ空港は既存のヴェネツィア・テッセラ空港(VCE)と同じ座標のエイリアスとして登録されている', () => {
    const existing = byName('ヴェネツィア・テッセラ空港');
    expect(existing).toMatchObject({ code: 'VCE', lat: 45.5053, lon: 12.3519 });
    const alias = byName('ベネチア・テッセラ空港');
    expect(alias).toMatchObject({ code: 'VCE', lat: 45.5053, lon: 12.3519 });
  });

  it('findHeritageAreaPointがユーザー指定表記のまま完全一致で解決できる', () => {
    expect(findHeritageAreaPoint('ローマ・フィウミチーノ空港')).toMatchObject({ code: 'FCO' });
    expect(findHeritageAreaPoint('ミラノ・リナーテ空港')).toMatchObject({ code: 'LIN' });
    expect(findHeritageAreaPoint('ベネチア・テッセラ空港')).toMatchObject({ code: 'VCE' });
  });
});
