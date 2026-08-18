// @vitest-environment jsdom
/**
 * GET /cheese-search ページの構造・挙動テスト
 *
 * 対象: フランスチーズ検索ページ(フリーワード検索+facetフィルタ)。
 * 各facetは「条件なし」をデフォルトとし、選択肢ごとに現在の絞り込み状態での
 * ヒット件数を「ラベル(件数)」の形式で表示、件数の多い順に左詰めで並ぶ想定。
 *
 * 故障シナリオ:
 *   (1) 認証なしでアクセスできてしまう
 *   (2) facetボタン(乳種/固さ/カビ/産地限定)や食材ペアリング検索欄が生成されない
 *   (3) client-side scriptにテンプレートリテラルのエスケープ起因の構文エラーが混入する
 *   (4) 「条件なし」がデフォルトで選択状態にならない
 *   (5) facet選択肢の表示順がヒット件数の降順にならない
 *   (6) facetボタンをクリックしても他のfacetの件数が再計算されない(選択の組み合わせ次第で件数が変わらないまま)
 *   (7) 固さfacetが「硬め/柔らかめ」の2値グループのままで、実際のカラム値(ハード/セミハード/セミソフト/ソフト)ごとの絞り込みができない
 *   (8) リスト(表)表示に切り替えてもデータがカード表示のままで、テーブル行が描画されない
 *   (9) 合う食材の🔑ボタンを押しても候補モーダルが開かない、またはヒット件数が0件のまま/降順にならない
 *   (10) pairingがnull(不明)の行が候補一覧から漏れる、または「不明」候補を選んでも絞り込みに反映されない
 *   (11) モーダルから候補を選択してもフリーワード検索窓(pairingInput)に反映されず絞り込みが行われない
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';
import { getCheeseSearchPage } from './views/cheeseSearch';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader() {
  const token = await createJWT({ sub: 'test-user', name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

describe('GET /cheese-search', () => {
  it('未認証の場合はページを返さない', async () => {
    const res = await app.request('/cheese-search', {}, { JWT_SECRET });
    expect(res.status).not.toBe(200);
  });

  it('認証済みの場合はHTMLページを返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/cheese-search',
      { headers: { Authorization: authHeader } },
      { JWT_SECRET }
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('フランスチーズ検索');
  });
});

describe('getCheeseSearchPage', () => {
  const html = getCheeseSearchPage('tester');

  it('facetフィルタ(乳種・固さ・カビ・産地限定)の描画先コンテナとヒット件数付き選択肢定義を含む', () => {
    expect(html).toContain('id="facetOptions-milk"');
    expect(html).toContain('id="facetOptions-hardness"');
    expect(html).toContain('id="facetOptions-mold"');
    expect(html).toContain('id="facetOptions-region"');
    expect(html).toContain("milk: [");
    expect(html).toContain("条件なし(");
  });

  it('フリーワード検索欄と食材ペアリング検索欄、🔑候補モーダルを含む', () => {
    expect(html).toContain('id="freeword"');
    expect(html).toContain('id="pairingInput"');
    expect(html).toContain('id="pairingKeyBtn"');
    expect(html).toContain('id="pairingModalOverlay"');
    expect(html).toContain('id="pairingCandidates"');
  });

  it('/api/cheese-frを呼び出す', () => {
    expect(html).toContain("fetch('/api/cheese-fr'");
  });

  it('テンプレートリテラル起因のエスケープ崩れがない(単引用符エスケープ・生regexリテラルなし)', () => {
    expect(html).not.toContain("\\'");
    expect(html).not.toContain('&#39;&#39;');
  });
});

describe('フランスチーズ検索ページ: facetのヒット件数・並び順・デフォルト状態', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  const ITEMS = [
    { seq_no: 1, name_fr: 'A', reading: 'あ', ingredient: '牛乳', producer: null, method: '白カビ', hardness: 'ソフト', notes: null, pairing: 'はちみつ、赤ワイン' },
    { seq_no: 2, name_fr: 'B', reading: 'い', ingredient: '牛乳', producer: 'X地方', method: 'セミハード', hardness: 'セミハード', notes: null, pairing: 'はちみつ、白ワイン' },
    { seq_no: 3, name_fr: 'C', reading: 'う', ingredient: '山羊乳', producer: null, method: '青カビ', hardness: 'セミソフト', notes: null, pairing: null },
  ];

  async function setup() {
    const html = getCheeseSearchPage('tester');
    const bodyIdx = html.indexOf('<body>') + 6;
    const scriptIdx = html.indexOf('<script>', bodyIdx);
    document.body.innerHTML = html.slice(bodyIdx, scriptIdx);
    const fetchMock = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ items: ITEMS }) }));
    vi.stubGlobal('fetch', fetchMock);
    const scriptSrc = html.slice(scriptIdx + 8, html.indexOf('</script>', scriptIdx));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('初期表示では各facetグループの「条件なし」がactiveになる', async () => {
    await setup();
    const milkGroup = document.getElementById('facetOptions-milk')!;
    const noneBtn = milkGroup.querySelector('.facet-btn[data-value=""]')!;
    expect(noneBtn.classList.contains('active')).toBe(true);
    expect(noneBtn.textContent).toContain('条件なし(3)');
  });

  it('facetの選択肢はヒット件数(牛乳2件・山羊乳1件)を含み降順(牛乳が山羊より左)に並ぶ', async () => {
    await setup();
    const milkGroup = document.getElementById('facetOptions-milk')!;
    const buttons = Array.from(milkGroup.querySelectorAll('.facet-btn'));
    const milkBtn = buttons.find((b) => b.getAttribute('data-value') === '牛乳')!;
    const goatBtn = buttons.find((b) => b.getAttribute('data-value') === '山羊')!;
    expect(milkBtn.textContent).toContain('牛乳(2)');
    expect(goatBtn.textContent).toContain('山羊(1)');
    expect(buttons.indexOf(milkBtn)).toBeLessThan(buttons.indexOf(goatBtn));
  });

  it('facetボタンをクリックすると他facetのヒット件数が絞り込み後の値に再計算される', async () => {
    await setup();
    const milkGroup = document.getElementById('facetOptions-milk')!;
    const milkBtn = milkGroup.querySelector('.facet-btn[data-value="牛乳"]') as HTMLButtonElement;
    milkBtn.click();

    const hardnessGroup = document.getElementById('facetOptions-hardness')!;
    const softBtn = Array.from(hardnessGroup.querySelectorAll('.facet-btn')).find((b) => b.getAttribute('data-value') === 'ソフト')!;
    // 牛乳(A:ソフト, B:セミハード)に絞り込んだ後は「ソフト」は1件のみ一致する
    expect(softBtn.textContent).toContain('ソフト(1)');
  });

  it('固さfacetの選択肢は実際の値(ハード/セミハード/セミソフト/ソフト)ごとに分かれている', async () => {
    await setup();
    const hardnessGroup = document.getElementById('facetOptions-hardness')!;
    const values = Array.from(hardnessGroup.querySelectorAll('.facet-btn')).map((b) => b.getAttribute('data-value'));
    expect(values).toContain('ハード');
    expect(values).toContain('セミハード');
    expect(values).toContain('セミソフト');
    expect(values).toContain('ソフト');
    expect(values).not.toContain('硬め');
    expect(values).not.toContain('柔らかめ');
  });

  it('リスト表示に切り替えるとカードが隠れテーブル行が描画される', async () => {
    await setup();
    const grid = document.getElementById('cheeseGrid')!;
    const tableWrap = document.getElementById('cheeseTableWrap')!;
    const tableBody = document.getElementById('cheeseTableBody')!;
    expect((grid as HTMLElement).style.display).not.toBe('none');
    expect((tableWrap as HTMLElement).style.display).toBe('none');

    (document.getElementById('viewListBtn') as HTMLButtonElement).click();

    expect((grid as HTMLElement).style.display).toBe('none');
    expect((tableWrap as HTMLElement).style.display).not.toBe('none');
    expect(tableBody.querySelectorAll('tr').length).toBe(ITEMS.length);
    expect(tableBody.textContent).toContain('A');
  });

  it('カード表示に戻すとテーブルが隠れカードが再表示される', async () => {
    await setup();
    (document.getElementById('viewListBtn') as HTMLButtonElement).click();
    (document.getElementById('viewCardBtn') as HTMLButtonElement).click();
    const grid = document.getElementById('cheeseGrid')!;
    const tableWrap = document.getElementById('cheeseTableWrap')!;
    expect((grid as HTMLElement).style.display).not.toBe('none');
    expect((tableWrap as HTMLElement).style.display).toBe('none');
    expect(grid.querySelectorAll('.cheese-card').length).toBe(ITEMS.length);
  });

  it('🔑ボタンを押すと合う食材の候補モーダルが開き、各行の値を「、」区切りで個別集計した候補がヒット件数順(はちみつ2件が赤ワイン/白ワイン/不明の各1件より左)に並ぶ', async () => {
    await setup();
    const overlay = document.getElementById('pairingModalOverlay')!;
    expect(overlay.classList.contains('open')).toBe(false);

    (document.getElementById('pairingKeyBtn') as HTMLButtonElement).click();

    expect(overlay.classList.contains('open')).toBe(true);
    const candidates = Array.from(document.querySelectorAll('#pairingCandidates .pairing-candidate-btn'));
    const honeyBtn = candidates.find((b) => b.getAttribute('data-value') === 'はちみつ')!;
    const redWineBtn = candidates.find((b) => b.getAttribute('data-value') === '赤ワイン')!;
    const whiteWineBtn = candidates.find((b) => b.getAttribute('data-value') === '白ワイン')!;
    const unknownBtn = candidates.find((b) => b.getAttribute('data-value') === '不明')!;
    expect(honeyBtn.textContent).toContain('はちみつ(2)');
    expect(redWineBtn.textContent).toContain('赤ワイン(1)');
    expect(whiteWineBtn.textContent).toContain('白ワイン(1)');
    expect(unknownBtn.textContent).toContain('不明(1)');
    expect(candidates.indexOf(honeyBtn)).toBeLessThan(candidates.indexOf(redWineBtn));
    expect(candidates.indexOf(honeyBtn)).toBeLessThan(candidates.indexOf(unknownBtn));
  });

  it('候補キーワードバッジ同士の間隔は縦横それぞれ1pxになっている', async () => {
    await setup();
    const html = getCheeseSearchPage('tester');
    expect(html).toMatch(/\.pairing-candidates\s*\{[^}]*gap:\s*1px;/);
  });

  it('候補を選択するとpairingInputに反映され絞り込みが行われ、モーダルが閉じる', async () => {
    await setup();
    (document.getElementById('pairingKeyBtn') as HTMLButtonElement).click();
    const unknownBtn = Array.from(document.querySelectorAll('#pairingCandidates .pairing-candidate-btn'))
      .find((b) => b.getAttribute('data-value') === '不明') as HTMLButtonElement;
    unknownBtn.click();

    const pairingInput = document.getElementById('pairingInput') as HTMLInputElement;
    expect(pairingInput.value).toBe('不明');
    const overlay = document.getElementById('pairingModalOverlay')!;
    expect(overlay.classList.contains('open')).toBe(false);
    expect(document.getElementById('resultCount')!.textContent).toContain('1 件');
  });

  it('閉じるボタンでモーダルが閉じる', async () => {
    await setup();
    (document.getElementById('pairingKeyBtn') as HTMLButtonElement).click();
    (document.getElementById('pairingModalCloseBtn') as HTMLButtonElement).click();
    expect(document.getElementById('pairingModalOverlay')!.classList.contains('open')).toBe(false);
  });
});
