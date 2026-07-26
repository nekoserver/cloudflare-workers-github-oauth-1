import { describe, expect, it } from 'vitest';
import { getWebGLHeritagePage } from './webglHeritage';

// 対象: /webgl-heritage ページの「🌇 近隣都市データ 国別集計」モーダル
//       (#city-stats-overlay) のヘッダに追加した国旗・国名インクリメンタルサーチ。
//
// 故障シナリオ:
//   (1) 検索窓がヘッダに無い / 右寄せにならない
//   (2) 行に検索キー(data-search)が埋め込まれず絞り込みが常に空振りする
//   (3) 国名(日本語)で検索できない(行が国コードと国旗しか持っていなかったため)
//   (4) モーダルを開き直したときに前回の検索語が残ったまま行だけ全表示に戻る
//   (5) 0件時に何も表示されず、絞り込み結果なのか取得失敗なのか区別できない
//   (6) template literal 内のエスケープ崩れで <script> が構文エラーになる

describe('国別集計モーダル: 国旗・国名インクリメンタルサーチ', () => {
  const html = getWebGLHeritagePage('tester');

  it('script タグ内の JS に構文エラーがない', () => {
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m: RegExpExecArray | null;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count++;
      expect(() => new Function(m![1])).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });

  it('国別集計モーダルのヘッダ内に検索窓が配置されている', () => {
    const headIdx = html.indexOf('🌇 近隣都市データ 国別集計');
    expect(headIdx).toBeGreaterThan(-1);
    const head = html.slice(headIdx, headIdx + 700);
    expect(head).toContain('id="city-stats-search"');
    expect(head).toContain('class="cities-modal-search"');
    expect(head).toContain('placeholder="🔍 国旗・国名"');
  });

  it('検索窓は閉じるボタンの直前(ヘッダ右側)に置かれている', () => {
    const searchIdx = html.indexOf('id="city-stats-search"');
    const closeIdx = html.indexOf('id="city-stats-close"');
    const titleIdx = html.indexOf('🌇 近隣都市データ 国別集計');
    expect(titleIdx).toBeLessThan(searchIdx);
    expect(searchIdx).toBeLessThan(closeIdx);
    // タイトルが flex:1 のため、後続要素は右寄せになる
    expect(html).toContain('.cities-modal-title { font-size:14px; font-weight:700; flex:1;');
  });

  it('検索窓のスタイルが定義されている(固定色でダークUIに追従)', () => {
    expect(html).toContain('.cities-modal-search {');
    expect(html).toContain('.cities-modal-search::placeholder');
    expect(html).toContain('.cities-modal-search:focus');
  });

  it('各行に「国旗 国コード 日本語国名」を小文字化した data-search が埋め込まれる', () => {
    expect(html).toContain("var jp = ccToJp(cc);");
    expect(html).toContain("var searchKey = escClientHtml((flag + ' ' + cc + ' ' + jp).toLowerCase());");
    expect(html).toContain("'<div class=\"cities-modal-row city-stats-row\" data-search=\"' + searchKey + '\"");
  });

  it('入力イベントでインクリメンタルに絞り込む', () => {
    expect(html).toContain('function applyCityStatsFilter()');
    expect(html).toContain("cityStatsSearch.addEventListener('input', applyCityStatsFilter);");
    expect(html).toContain("cityStatsBody.querySelectorAll('.city-stats-row')");
    expect(html).toContain('key.indexOf(q) !== -1');
    expect(html).toContain("row.style.display = show ? '' : 'none';");
  });

  it('絞り込みは正規表現を使わず部分一致で行う(テンプレートリテラルのエスケープ事故回避)', () => {
    const fnIdx = html.indexOf('function applyCityStatsFilter()');
    const block = html.slice(fnIdx, fnIdx + 700);
    expect(block).not.toMatch(/new RegExp/);
    expect(block).toContain('.trim().toLowerCase()');
  });

  it('モーダルを開くたびに検索窓がリセットされる', () => {
    const btnIdx = html.indexOf("document.getElementById('btnCityStats').addEventListener('click'");
    expect(btnIdx).toBeGreaterThan(-1);
    const block = html.slice(btnIdx, btnIdx + 400);
    expect(block).toContain("cityStatsSearch.value = '';");
  });

  it('行の再描画後に現在の検索語を適用し直す', () => {
    const idx = html.indexOf("cityStatsBody.innerHTML = html;");
    expect(idx).toBeGreaterThan(-1);
    const block = html.slice(idx, idx + 500);
    expect(block).toContain('applyCityStatsFilter();');
  });

  it('該当0件のときに専用メッセージを表示する', () => {
    expect(html).toContain('id="city-stats-no-hit"');
    expect(html).toContain('該当する国が見つかりません');
    expect(html).toContain("noHit.style.display = (visible === 0) ? '' : 'none';");
  });
});
