import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getHeritageAreaPage } from './views/heritageArea';

// 対象: heritage-areaページの「検索露出ログ検索結果」欄(results-matched/results-unmatched)。
// 各行の世界遺産名カラムの先頭に、その世界遺産が属する国の国旗(heritage_point.flag)を表示する。
// 故障シナリオ:
//   (1) heritage_pointがnull(空港名やheritage_point解決できない項目)の場合に例外を投げる/undefinedを描画する
//   (2) 国旗が国名(country)無しで表示されtitle属性が空になる
//   (3) 距離prefix(distance-prefix)や見どころアイコンより後ろに国旗が出て「先頭配置」の要件を満たさない
//   (4) エリア番号ブラウズ(/api/heritage-area/areas/:areaSeq/items)経由の行にはheritage_pointが
//       付与されず、検索結果(/api/heritage-area/search)経由の行としか国旗の表示が揃わない
function extractPureFunctions(html: string): string {
  const lines = html.split('\n');
  const prefixes = [
    'const esc=',
    'let gemmaCache=',
    'function distancePrefix(',
    'function mitokoroIconsHtml(',
    'function resultFlagHtml(',
    'function resultNameHtml(',
  ];
  const found = prefixes.map((prefix) => lines.find((line) => line.startsWith(prefix)));
  if (found.some((line) => !line)) {
    throw new Error('必要な関数が生成HTMLから見つからない: ' + JSON.stringify(prefixes.filter((_, i) => !found[i])));
  }
  return found.join('\n');
}

function loadFns(html: string) {
  const src = extractPureFunctions(html);
  return new Function(`${src}\nreturn { resultFlagHtml, resultNameHtml };`)();
}

describe('heritage-areaページ: 検索結果欄の世界遺産名カラム先頭に国旗を表示する', () => {
  it('heritage_pointに国旗がある行は、行の一番先頭に国旗spanを出す(distance-prefixや遺産名より前)', () => {
    const html = getHeritageAreaPage();
    const { resultNameHtml } = loadFns(html);
    const out = resultNameHtml({
      item_name: '姫路城',
      distance_km: 80,
      heritage_point: { flag: '🇯🇵', country: '日本', lat: 34.84, lon: 134.69 },
    });
    expect(out.indexOf('<span class="kw-flag"')).toBe(0);
    expect(out.indexOf('🇯🇵')).toBeGreaterThan(0);
    expect(out.indexOf('kw-flag')).toBeLessThan(out.indexOf('distance-prefix'));
    expect(out.indexOf('kw-flag')).toBeLessThan(out.indexOf('姫路城'));
    expect(out).toContain('title="日本"');
  });

  it('heritage_pointがnull/未設定の行は国旗を出さず、例外も投げない(空港名など未解決キーワード)', () => {
    const html = getHeritageAreaPage();
    const { resultNameHtml } = loadFns(html);
    expect(() => resultNameHtml({ item_name: '謎のキーワード', heritage_point: null })).not.toThrow();
    const out = resultNameHtml({ item_name: '謎のキーワード', heritage_point: null });
    expect(out).not.toContain('kw-flag');
    const out2 = resultNameHtml({ item_name: '謎のキーワード' });
    expect(out2).not.toContain('kw-flag');
  });

  it('resultFlagHtmlはheritage_point.flagが空文字の場合も国旗を出さない', () => {
    const html = getHeritageAreaPage();
    const { resultFlagHtml } = loadFns(html);
    expect(resultFlagHtml({ heritage_point: { flag: '', country: '日本' } })).toBe('');
  });

  it('/api/heritage-area/areas/:areaSeq/items のレスポンスにもheritage_pointを含める(エリア番号ブラウズ経由の行にも国旗表示を揃える)', () => {
    const src = readFileSync('src/index.ts', 'utf8');
    const routeIdx = src.indexOf("app.get('/api/heritage-area/areas/:areaSeq/items'");
    expect(routeIdx).toBeGreaterThan(-1);
    const routeBody = src.slice(routeIdx, routeIdx + 2000);
    expect(routeBody).toContain('heritage_point: findHeritageAreaPoint(name)');
  });
});
