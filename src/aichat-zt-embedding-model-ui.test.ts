// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットのZT(Zanzibar分類ツリー)モーダル。
//   (1) 初期画面のヘッダ右側に新設した📖アイコン(ztOverviewBtn)を押すと、
//       最上位レイヤーに既存のベクタ化済みデータ一覧(ztOverviewModal)が開く
//   (2) 「🗒️ 問い合わせデータ」モーダルのモデル名部分がドロップダウンになり、
//       bge-m3 / plamo-embedding-1b(@cf/pfnet/plamo-embedding-1b)を選べる
//   (3) ドロップダウンの選択が、実際にプレビューされる問い合わせ内容(payload.model)
//       に動的に反映され、「登録する」ボタンのPOST bodyにも反映される
//
// 故障シナリオ:
//   (1) 📖アイコンがヘッダ右側(閉じるボタンの近く)に無い、または別のモーダルの裏に隠れる
//   (2) ドロップダウンでplamoを選んでもプレビュー内容がbge-m3のまま変わらない
//   (3) 「登録する」実行時に選択中のモデルがサーバーへ送られない
//   (4) 一覧のmodelが空/未設定の行が「bge-m3」で補完されずに空欄になる
//   (5) 一覧が特定のsource(ZTモーダル手動登録)だけに絞り込まれ、実際に
//       登録済みのデータやanswer-graph色分け等で自動生成されたデータが
//       一覧から見えなくなる(「あるはずのデータが表示されない」regression)

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('ZTモーダルのHTML構造: 📖アイコン・一覧モーダル・モデル選択ドロップダウン', () => {
  it('ztOverviewBtnがztTreeModalのヘッダ内、ztTreeCloseの近くに存在する', () => {
    const html = buildPage();
    const modalIdx = html.indexOf('id="ztTreeModal"');
    const headEndIdx = html.indexOf('</div>', html.indexOf('zt-tree-search-wrap', modalIdx));
    const head = html.slice(modalIdx, headEndIdx);
    expect(head).toContain('id="ztOverviewBtn"');
    expect(head).toContain('id="ztTreeClose"');
  });

  it('ztOverviewModalが存在し、閉じるボタン・本文コンテナを持つ', () => {
    const html = buildPage();
    expect(html).toContain('id="ztOverviewModal"');
    expect(html).toContain('id="ztOverviewClose"');
    expect(html).toContain('id="ztOverviewBody"');
  });

  it('ztOverviewChartToggle(📊)ボタンがタイトルとztOverviewCloseの間にある', () => {
    const html = buildPage();
    const modalIdx = html.indexOf('id="ztOverviewModal"');
    const bodyIdx = html.indexOf('id="ztOverviewBody"', modalIdx);
    const head = html.slice(modalIdx, bodyIdx);
    expect(head).toContain('id="ztOverviewChartToggle"');
    const toggleIdx = head.indexOf('id="ztOverviewChartToggle"');
    const closeIdx = head.indexOf('id="ztOverviewClose"');
    expect(toggleIdx).toBeGreaterThan(-1);
    expect(closeIdx).toBeGreaterThan(toggleIdx);
  });

  it('ztOverviewKeywordSearchInput(検索窓)が📊ボタンの左側に存在する', () => {
    const html = buildPage();
    const modalIdx = html.indexOf('id="ztOverviewModal"');
    const bodyIdx = html.indexOf('id="ztOverviewBody"', modalIdx);
    const head = html.slice(modalIdx, bodyIdx);
    const searchIdx = head.indexOf('id="ztOverviewKeywordSearchInput"');
    const toggleIdx = head.indexOf('id="ztOverviewChartToggle"');
    expect(searchIdx).toBeGreaterThan(-1);
    expect(toggleIdx).toBeGreaterThan(searchIdx);
  });

  it('ztOverviewChartSectionがタイトル(head)とztOverviewBody(表)の間にある', () => {
    const html = buildPage();
    const modalIdx = html.indexOf('id="ztOverviewModal"');
    const headEndIdx = html.indexOf('</div>', html.indexOf('search-log-head', modalIdx));
    const bodyIdx = html.indexOf('id="ztOverviewBody"', modalIdx);
    const chartSectionIdx = html.indexOf('id="ztOverviewChartSection"', modalIdx);
    expect(chartSectionIdx).toBeGreaterThan(headEndIdx);
    expect(chartSectionIdx).toBeLessThan(bodyIdx);
  });

  it('ztOverviewModalがstaticZDefaultsに登録されている(z-index管理の原則)', () => {
    const html = buildPage();
    const idx = html.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    expect(html.slice(idx, idx + 500)).toContain('ztOverviewModal');
  });

  it('ztBgeModelSelectがbge-m3・plamo-embedding-1b・embeddinggemma-300mをoptionに持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('id="ztBgeModelSelect"');
    expect(idx).toBeGreaterThan(-1);
    const selectHtml = html.slice(idx, html.indexOf('</select>', idx));
    expect(selectHtml).toContain('value="@cf/baai/bge-m3"');
    expect(selectHtml).toContain('value="@cf/pfnet/plamo-embedding-1b"');
    expect(selectHtml).toContain('value="@cf/google/embeddinggemma-300m"');
  });
});

async function setupZtUi() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));

  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/keyword-embeddings/list')) {
      const body = {
        items: [
          { keyword: 'Hono', model: '@cf/baai/bge-m3', dim: 1024, updatedAt: '2026-01-01', source: 'zt_manual', plamoModel: null, plamoDim: null },
          { keyword: '空港', model: '', dim: 1024, updatedAt: '2026-01-01', source: 'answer_graph_color', plamoModel: '@cf/pfnet/plamo-embedding-1b', plamoDim: 2048 },
          { keyword: '駅', model: '@cf/baai/bge-m3', dim: 1024, updatedAt: '2026-01-01', source: 'zt_manual', gemmaModel: '@cf/google/embeddinggemma-300m', gemmaDim: 768 },
          { keyword: 'テスト', model: '@cf/baai/bge-m3', dim: 1024, updatedAt: '2026-01-01', source: 'zt_manual', gemmaModel: '@cf/google/embeddinggemma-300m', gemmaDim: 768 },
        ],
      };
      return Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify(body)),
        json: () => Promise.resolve(body),
      });
    }
    if (u.includes('/api/aichat/keyword-embeddings/register')) {
      return Promise.resolve({ json: () => Promise.resolve({ ok: true, registered: 1, failed: 0, results: [] }) });
    }
    if (u.includes('/api/aichat/all-keywords')) {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ keywords: [{ keyword: 'a' }, { keyword: 'b' }, { keyword: 'c' }] }),
      });
    }
    if (u.includes('/api/aichat/shares/by-keyword')) {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({
          keyword: 'Hono',
          results: [
            { id: 's1', user_hash: 'uh1', question: 'Honoの使い方は？', answer: '...', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', created_at: '2026-01-02T10:00:00Z' },
          ],
        }),
      });
    }
    if (u.includes('/api/aichat/shares/s1')) {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({
          id: 's1', user_hash: 'uh1', question: 'Honoの使い方は？', answer: 'Honoはこう使います',
          model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', created_at: '2026-01-02T10:00:00Z', access_count: 1,
        }),
      });
    }
    return Promise.resolve({ status: 200, text: () => Promise.resolve('{}'), json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });

  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  return {
    ztOverviewBtn: document.getElementById('ztOverviewBtn')!,
    ztOverviewModal: document.getElementById('ztOverviewModal')!,
    ztOverviewBody: document.getElementById('ztOverviewBody')!,
    ztOverviewChartToggle: document.getElementById('ztOverviewChartToggle')!,
    ztOverviewChartSection: document.getElementById('ztOverviewChartSection')!,
    ztOverviewKeywordSearchInput: document.getElementById('ztOverviewKeywordSearchInput') as unknown as HTMLInputElement,
    ztKeywordSharesModal: document.getElementById('ztKeywordSharesModal')!,
    ztKeywordSharesClose: document.getElementById('ztKeywordSharesClose')!,
    ztKeywordSharesBody: document.getElementById('ztKeywordSharesBody')!,
    ztKeywordSharesTitle: document.getElementById('ztKeywordSharesTitle')!,
    ztBgeBtn: document.getElementById('ztBgeBtn')!,
    ztBgeModal: document.getElementById('ztBgeModal')!,
    ztBgeBody: document.getElementById('ztBgeBody')!,
    ztBgeModelSelect: document.getElementById('ztBgeModelSelect') as unknown as HTMLSelectElement,
    ztBgeRegisterBtn: document.getElementById('ztBgeRegisterBtn')!,
    fetchMock,
  };
}

describe('ZTモーダルのDOM実動作(jsdom)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = 'aichat_zt_overview_chart_visible=; Path=/; Max-Age=0';
  });

  it('📖アイコンを押すと最上位レイヤーにベクタ化済みデータ一覧が開き、既存データとモデルが列挙される', async () => {
    const { ztOverviewBtn, ztOverviewModal, ztOverviewBody } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ztOverviewModal.classList.contains('open')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ztOverviewBody.textContent).toContain('Hono');
    expect(ztOverviewBody.textContent).toContain('@cf/baai/bge-m3');
    // modelが空文字の行は表示上bge-m3で補完される
    expect(ztOverviewBody.textContent).toContain('bge-m3');
    // plamoの情報も併記される
    expect(ztOverviewBody.textContent).toContain('@cf/pfnet/plamo-embedding-1b');
    // gemmaの情報も併記される
    expect(ztOverviewBody.textContent).toContain('@cf/google/embeddinggemma-300m');
    // sourceに応じたラベルが表示され、自動生成データも隠さず一覧に出る
    expect(ztOverviewBody.textContent).toContain('ZTモーダル手動登録');
    expect(ztOverviewBody.textContent).toContain('自動(answer-graph色分け)');
    expect(ztOverviewBody.textContent).toContain('空港');
  });

  it('📖アイコンを押すと埋め込みモデル別の登録済みキーワード率円グラフがタイトルと表の間に表示される(cookie未設定時はデフォルトON)', async () => {
    const { ztOverviewBtn, ztOverviewChartSection } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(ztOverviewChartSection.style.display).not.toBe('none');
    expect(ztOverviewChartSection.textContent).toContain('登録済みキーワード率');
    expect(ztOverviewChartSection.textContent).toContain('bge-m3');
    expect(ztOverviewChartSection.textContent).toContain('plamo-embedding-1b');
    expect(ztOverviewChartSection.textContent).toContain('embeddinggemma-300m');
    expect(ztOverviewChartSection.innerHTML).toContain('<path ');
  });

  it('📊ボタンを押すと円グラフ表示がOFFになり、cookieにoffが保存される。もう一度押すとONに戻りcookieもonになる', async () => {
    const { ztOverviewBtn, ztOverviewChartToggle, ztOverviewChartSection } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ztOverviewChartSection.style.display).not.toBe('none');

    ztOverviewChartToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ztOverviewChartSection.style.display).toBe('none');
    expect(document.cookie).toContain('aichat_zt_overview_chart_visible=off');

    ztOverviewChartToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ztOverviewChartSection.style.display).not.toBe('none');
    expect(document.cookie).toContain('aichat_zt_overview_chart_visible=on');
  });

  it('cookieにoffが保存されている状態でモーダルを開くと円グラフは非表示のまま', async () => {
    document.cookie = 'aichat_zt_overview_chart_visible=off; Path=/';
    const { ztOverviewBtn, ztOverviewChartSection } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(ztOverviewChartSection.style.display).toBe('none');
  });

  it('埋め込みモデルヘッダの右側にztOverviewModelFilterドロップダウンが表示され、「すべて」が最上位、以降はベクタ化済みキーワード総数の多い順に並ぶ', async () => {
    const { ztOverviewBtn, ztOverviewBody } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const select = document.getElementById('ztOverviewModelFilter') as unknown as HTMLSelectElement;
    expect(select).toBeTruthy();
    // ヘッダ(埋め込みモデル)の右側にあること
    const thIdx = ztOverviewBody.innerHTML.indexOf('埋め込みモデル');
    const selectIdx = ztOverviewBody.innerHTML.indexOf('id="ztOverviewModelFilter"');
    expect(selectIdx).toBeGreaterThan(thIdx);

    const options = Array.from(select.options).map((o) => ({ value: o.value, label: o.textContent }));
    // items: bge-m3=4件(全件), embeddinggemma-300m=2件(駅,テスト), plamo-embedding-1b=1件(空港)
    expect(options[0]).toEqual({ value: 'all', label: 'すべて' });
    expect(options[1].value).toBe('bge');
    expect(options[1].label).toContain('bge-m3');
    expect(options[1].label).toContain('4');
    expect(options[2].value).toBe('gemma');
    expect(options[2].label).toContain('embeddinggemma-300m');
    expect(options[2].label).toContain('2');
    expect(options[3].value).toBe('plamo');
    expect(options[3].label).toContain('plamo-embedding-1b');
    expect(options[3].label).toContain('1');
  });

  it('ドロップダウンでplamo-embedding-1bを選ぶと、plamoが登録されているキーワードだけに表が絞り込まれる', async () => {
    const { ztOverviewBtn, ztOverviewBody } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const select = document.getElementById('ztOverviewModelFilter') as unknown as HTMLSelectElement;
    select.value = 'plamo';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(ztOverviewBody.textContent).toContain('空港');
    expect(ztOverviewBody.textContent).not.toContain('Hono');
    expect(ztOverviewBody.textContent).not.toContain('駅');
    expect(ztOverviewBody.textContent).not.toContain('テスト');
  });

  it('ドロップダウンでembeddinggemma-300mを選ぶと、gemmaが登録されているキーワードだけに表が絞り込まれる', async () => {
    const { ztOverviewBtn, ztOverviewBody } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const select = document.getElementById('ztOverviewModelFilter') as unknown as HTMLSelectElement;
    select.value = 'gemma';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(ztOverviewBody.textContent).toContain('駅');
    expect(ztOverviewBody.textContent).toContain('テスト');
    expect(ztOverviewBody.textContent).not.toContain('Hono');
    expect(ztOverviewBody.textContent).not.toContain('空港');
  });

  it('ドロップダウンで「すべて」に戻すと全キーワードが再び表示される', async () => {
    const { ztOverviewBtn, ztOverviewBody } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const select = document.getElementById('ztOverviewModelFilter') as unknown as HTMLSelectElement;
    select.value = 'plamo';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    const selectAfter = document.getElementById('ztOverviewModelFilter') as unknown as HTMLSelectElement;
    selectAfter.value = 'all';
    selectAfter.dispatchEvent(new Event('change', { bubbles: true }));

    expect(ztOverviewBody.textContent).toContain('Hono');
    expect(ztOverviewBody.textContent).toContain('空港');
    expect(ztOverviewBody.textContent).toContain('駅');
    expect(ztOverviewBody.textContent).toContain('テスト');
  });

  it('検索窓にキーワードを入力すると、表がそのキーワードを含む行だけに絞り込まれる', async () => {
    const { ztOverviewBtn, ztOverviewBody, ztOverviewKeywordSearchInput } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    ztOverviewKeywordSearchInput.value = '空港';
    ztOverviewKeywordSearchInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(ztOverviewBody.textContent).toContain('空港');
    expect(ztOverviewBody.textContent).not.toContain('Hono');
    expect(ztOverviewBody.textContent).not.toContain('テスト');
  });

  it('検索窓とモデル絞り込みドロップダウンは併用でき、両方の条件を満たす行だけ表示される', async () => {
    const { ztOverviewBtn, ztOverviewBody, ztOverviewKeywordSearchInput } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    var select = document.getElementById('ztOverviewModelFilter') as unknown as HTMLSelectElement;
    select.value = 'gemma';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    ztOverviewKeywordSearchInput.value = 'テスト';
    ztOverviewKeywordSearchInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(ztOverviewBody.textContent).toContain('テスト');
    expect(ztOverviewBody.textContent).not.toContain('駅');
    expect(ztOverviewBody.textContent).not.toContain('Hono');
  });

  it('検索窓は空文字に戻すと全キーワードが再び表示される', async () => {
    const { ztOverviewBtn, ztOverviewBody, ztOverviewKeywordSearchInput } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    ztOverviewKeywordSearchInput.value = '空港';
    ztOverviewKeywordSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    ztOverviewKeywordSearchInput.value = '';
    ztOverviewKeywordSearchInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(ztOverviewBody.textContent).toContain('Hono');
    expect(ztOverviewBody.textContent).toContain('空港');
    expect(ztOverviewBody.textContent).toContain('駅');
    expect(ztOverviewBody.textContent).toContain('テスト');
  });

  it('表のth(ヘッダ行)にposition:stickyが指定され、スクロールしても上部に固定される', async () => {
    const { ztOverviewBtn, ztOverviewBody } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const ths = ztOverviewBody.querySelectorAll('th');
    expect(ths.length).toBeGreaterThan(0);
    ths.forEach((th) => {
      expect(th.getAttribute('style') || '').toContain('position:sticky');
      expect(th.getAttribute('style') || '').toContain('top:0');
    });
  });

  it('表内の各キーワードはリンクになっており、タップすると最上位レイヤーのモーダルで関連する会話一覧が表示される', async () => {
    const { ztOverviewBtn, ztOverviewBody, ztOverviewModal, ztKeywordSharesModal, ztKeywordSharesBody, ztKeywordSharesTitle, fetchMock } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const link = ztOverviewBody.querySelector('.zt-overview-kw-link[data-keyword="Hono"]') as HTMLElement;
    expect(link).toBeTruthy();

    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ztKeywordSharesModal.classList.contains('open')).toBe(true);
    expect(ztKeywordSharesTitle.textContent).toContain('Hono');

    const byKeywordCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/aichat/shares/by-keyword'));
    expect(byKeywordCall).toBeTruthy();
    expect(String(byKeywordCall![0])).toContain('keyword=Hono');

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ztKeywordSharesBody.textContent).toContain('Honoの使い方は？');
    // タイトルの「の関連する会話」の右側に検索結果件数が"(件数)"形式で表示される
    expect(ztKeywordSharesTitle.textContent).toContain('の関連する会話 (1)');
    // 各質問文の行頭に通し番号が付与される
    expect(ztKeywordSharesBody.textContent).toContain('1. Honoの使い方は？');

    // 別タブに移動するのではなく、ztOverviewModalの上に重なるモーダルとして表示される(getNextZ()で動的算出)
    expect(ztOverviewModal.classList.contains('open')).toBe(true);
    const zOverview = parseInt(ztOverviewModal.style.zIndex, 10);
    const zShares = parseInt(ztKeywordSharesModal.style.zIndex, 10);
    expect(zShares).toBeGreaterThan(zOverview);
  });

  it('「関連する会話」モーダルの「🔗 別タブで開く」リンクはデフォルトでOFF(表示されない)', async () => {
    const { ztOverviewBtn, ztOverviewBody, ztKeywordSharesBody } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const link = ztOverviewBody.querySelector('.zt-overview-kw-link[data-keyword="Hono"]') as HTMLElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(ztKeywordSharesBody.textContent).not.toContain('別タブで開く');
    expect(ztKeywordSharesBody.innerHTML).not.toContain('/s/uh1/s1');
  });

  it('「関連する会話」モーダル内の質問文をタップすると、左サイドパネルの質問タップ時と同じ質問/回答バブルモーダルがキーワードハイライト付きで表示される', async () => {
    const { ztOverviewBtn, ztOverviewBody, ztKeywordSharesBody, fetchMock } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const link = ztOverviewBody.querySelector('.zt-overview-kw-link[data-keyword="Hono"]') as HTMLElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const qEl = ztKeywordSharesBody.querySelector('.zt-keyword-share-q') as HTMLElement;
    expect(qEl).toBeTruthy();
    expect(qEl.getAttribute('data-share-id')).toBe('s1');
    expect(qEl.getAttribute('data-keyword')).toBe('Hono');

    qEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const shareCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/aichat/shares/s1'));
    expect(shareCall).toBeTruthy();

    const historyModalBackdrop = document.getElementById('historyModalBackdrop')!;
    const historyModalChat = document.getElementById('historyModalChat')!;
    expect(historyModalBackdrop.classList.contains('open')).toBe(true);
    expect(historyModalChat.textContent).toContain('Honoの使い方は？');
    expect(historyModalChat.querySelector('mark.kw-highlight')).toBeTruthy();
  });

  it('ztKeywordSharesCloseを押すとztKeywordSharesModalが閉じる', async () => {
    const { ztOverviewBtn, ztOverviewBody, ztKeywordSharesModal, ztKeywordSharesClose } = await setupZtUi();

    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const link = ztOverviewBody.querySelector('.zt-overview-kw-link') as HTMLElement;
    link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ztKeywordSharesModal.classList.contains('open')).toBe(true);

    ztKeywordSharesClose.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ztKeywordSharesModal.classList.contains('open')).toBe(false);
  });

  it('📖アイコンで開いたモーダルのz-indexはgetNextZ()で実行時に動的算出される(固定値を書かない)', async () => {
    const html = buildPage();
    const modalTagStart = html.indexOf('id="ztOverviewModal"');
    const tagSnippet = html.slice(html.lastIndexOf('<div', modalTagStart), modalTagStart + 60);
    expect(tagSnippet).not.toMatch(/style="[^"]*z-index/);

    const { ztOverviewBtn, ztOverviewModal } = await setupZtUi();
    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const z = parseInt(ztOverviewModal.style.zIndex, 10);
    expect(z).toBeGreaterThan(0);

    // ztBgeModal(z-index既定905)を先に開いてから一覧を開くと、
    // getNextZ()がその時点の最大z-indexを見て一覧側により大きい値を割り当てる
    const ztBgeModal = document.getElementById('ztBgeModal')!;
    const ztBgeBtn = document.getElementById('ztBgeBtn')!;
    ztOverviewModal.classList.remove('open');
    ztBgeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ztBgeModal.classList.contains('open')).toBe(true);
    ztOverviewBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const zAfter = parseInt(ztOverviewModal.style.zIndex, 10);
    const zBge = parseInt(ztBgeModal.style.zIndex, 10);
    expect(zAfter).toBeGreaterThan(zBge);
  });

  it('ドロップダウンでplamo-embedding-1bを選ぶと、プレビューされる問い合わせ内容のmodelが動的に切り替わる', async () => {
    const { ztBgeBtn, ztBgeBody, ztBgeModelSelect } = await setupZtUi();

    ztBgeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(ztBgeBody.textContent).toContain('"model": "@cf/baai/bge-m3"');

    ztBgeModelSelect.value = '@cf/pfnet/plamo-embedding-1b';
    ztBgeModelSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(ztBgeBody.textContent).toContain('"model": "@cf/pfnet/plamo-embedding-1b"');
    expect(ztBgeBody.textContent).not.toContain('"model": "@cf/baai/bge-m3"');
  });

  it('「登録する」を押すと表示中の問い合わせ内容(選択中のモデル込み)がそのままPOST bodyに送られる', async () => {
    const { ztBgeBtn, ztBgeBody, ztBgeModelSelect, ztBgeRegisterBtn, fetchMock } = await setupZtUi();

    ztBgeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    ztBgeModelSelect.value = '@cf/pfnet/plamo-embedding-1b';
    ztBgeModelSelect.dispatchEvent(new Event('change', { bubbles: true }));
    // このテスト環境ではZTツリー検索状態が空のため実際の対象キーワードが無い。
    // 「登録する」がプレビュー内容(表示中のJSON)をそのまま送る実装であることを
    // 検証するため、実際に検索でヒットした状態を模してプレビューへ直接反映する。
    ztBgeBody.textContent = JSON.stringify({ model: ztBgeModelSelect.value, input: { text: ['駅'] } });

    ztBgeRegisterBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const registerCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/aichat/keyword-embeddings/register'));
    expect(registerCall).toBeTruthy();
    const body = JSON.parse((registerCall as unknown as [string, RequestInit])[1].body as string);
    expect(body.model).toBe('@cf/pfnet/plamo-embedding-1b');
  });
});
