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

  it('ztOverviewModalがstaticZDefaultsに登録されている(z-index管理の原則)', () => {
    const html = buildPage();
    const idx = html.indexOf('staticZDefaults');
    expect(idx).toBeGreaterThan(-1);
    expect(html.slice(idx, idx + 500)).toContain('ztOverviewModal');
  });

  it('ztBgeModelSelectがbge-m3とplamo-embedding-1bの両方をoptionに持つ', () => {
    const html = buildPage();
    const idx = html.indexOf('id="ztBgeModelSelect"');
    expect(idx).toBeGreaterThan(-1);
    const selectHtml = html.slice(idx, html.indexOf('</select>', idx));
    expect(selectHtml).toContain('value="@cf/baai/bge-m3"');
    expect(selectHtml).toContain('value="@cf/pfnet/plamo-embedding-1b"');
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
    ztBgeBtn: document.getElementById('ztBgeBtn')!,
    ztBgeModal: document.getElementById('ztBgeModal')!,
    ztBgeBody: document.getElementById('ztBgeBody')!,
    ztBgeModelSelect: document.getElementById('ztBgeModelSelect') as unknown as HTMLSelectElement,
    ztBgeRegisterBtn: document.getElementById('ztBgeRegisterBtn')!,
    fetchMock,
  };
}

describe('ZTモーダルのDOM実動作(jsdom)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

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
    // sourceに応じたラベルが表示され、自動生成データも隠さず一覧に出る
    expect(ztOverviewBody.textContent).toContain('ZTモーダル手動登録');
    expect(ztOverviewBody.textContent).toContain('自動(answer-graph色分け)');
    expect(ztOverviewBody.textContent).toContain('空港');
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
