// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { getAiChatPage } from './views/aichat';
import { extractFunctionSource } from './utils/extractFunctionSource';

// 対象: 「分類: ◯」モーダル(openKwClassifyModal, src/views/aichat.ts)内で
// カテゴリバッジの🎨から色を変更したあと、「分類決定」ボタンを押して
// キーワード分類モーダル(呼び出し元のリスト)へフォーカスが戻ったときに、
// その色変更が反映されているかどうかを実際のDOM操作・実際に生成されたJSソースで検証する。
//
// これまでの調査ではソースコードを目視で追う限り「色PATCH→分類決定でリスト再描画」の
// 順序は正しいはずだったが、ユーザーから繰り返し「反映されない」報告があったため、
// 実際に生成されたJSを抽出してjsdom上で本物のクリックイベントを発火させ、
// サーバー(モック)側の状態が更新されたタイミングと再描画呼び出しのタイミングを
// 実際に検証する。
//
// 故障シナリオ:
//   (1) 色エディタのPATCHが非同期のまま完了を待たずに「分類決定」の再描画が呼ばれ、
//       古い色のままのレスポンスを再描画に使ってしまう
//   (2) loadCategories() の再取得が完了する前に「分類決定」が押され、
//       選択中カテゴリ(selectedCatIds)がリセットされて意図しないカテゴリが保存される
//   (3) 色変更後にoverlayが閉じずrenderKwClassifyList()が呼ばれない

const minimalUser = {
  username: 'testuser',
  aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  modelColors: { '@cf/meta/llama-3.3-70b-instruct-fp8-fast': '#4f46e5' },
};

function buildPage(): string {
  return getAiChatPage(minimalUser);
}

async function flush(times = 5) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
}

function loadOpenKwClassifyModal() {
  const html = buildPage();
  const src = extractFunctionSource(html, 'openKwClassifyModal');
  expect(src, 'openKwClassifyModal が生成HTMLから見つからない').toBeTruthy();
  const fn = new Function(
    'document', 'fetch', 'KW_CAT_COLORS', 'getNextZ', 'renderKwClassifyList',
    `${src}\nreturn openKwClassifyModal;`
  );
  return fn as (
    document: Document,
    fetch: typeof globalThis.fetch,
    KW_CAT_COLORS: string[],
    getNextZ: () => number,
    renderKwClassifyList: () => void,
  ) => (keyword: string, onSaved?: () => void) => void;
}

describe('分類:◯ モーダル: 色エディタでの色変更が「分類決定」後のリストへ反映される', () => {
  it('色PATCHが解決してから分類決定が押された場合、renderKwClassifyList呼び出し時点でサーバー側の色は更新済みである', async () => {
    const serverDb = {
      categories: [{ id: 1, name: 'カテゴリA', color: '#111111', is_mapped: 1 }],
    };
    const renderKwClassifyList = vi.fn(() => {
      // このコールバック実行時点のserverDb.colorをスナップショットする
      colorAtRenderTime = serverDb.categories[0].color;
    });
    let colorAtRenderTime: string | null = null;

    const fetchMock = vi.fn(async (url: string, opts?: RequestInit) => {
      if (url.startsWith('/api/aichat/keyword-categories?keyword=')) {
        return {
          ok: true,
          json: async () => ({ categories: serverDb.categories.map((c) => ({ ...c })) }),
        } as Response;
      }
      if (url === '/api/aichat/keyword-category-suggest') {
        return { ok: true, json: async () => ({}) } as Response;
      }
      if (url.startsWith('/api/aichat/keyword-categories/') && opts?.method === 'PATCH') {
        const body = JSON.parse(String(opts.body));
        serverDb.categories[0].color = body.color;
        return { ok: true, json: async () => ({ ok: true, category: { id: 1, color: body.color } }) } as Response;
      }
      if (url === '/api/aichat/keyword-category-map') {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      throw new Error('unexpected fetch: ' + url);
    });

    const openKwClassifyModal = loadOpenKwClassifyModal()(
      document,
      fetchMock as unknown as typeof fetch,
      ['#111111', '#222222', '#333333'],
      () => 999,
      renderKwClassifyList,
    );

    openKwClassifyModal('テストキーワード');
    await flush();

    // 色エディタを開く
    const editDot = document.querySelector('.kwcat-color-edit-dot') as HTMLElement;
    expect(editDot, '🎨アイコンが見つからない').toBeTruthy();
    editDot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    // 元の色(#111111)ではない色のスウォッチを選ぶ
    const swatches = Array.from(document.querySelectorAll('.kwcat-color-edit-swatch')) as HTMLElement[];
    const newSwatch = swatches.find((s) => s.dataset.color !== '#111111')!;
    expect(newSwatch, '色スウォッチが見つからない').toBeTruthy();
    newSwatch.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    // PATCHが実際にサーバー側の色を書き換えたことを確認
    expect(serverDb.categories[0].color).toBe(newSwatch.dataset.color);

    // 「分類決定」を押す
    const decideBtn = document.querySelector('.kwcat-decide-btn') as HTMLButtonElement;
    expect(decideBtn, '分類決定ボタンが見つからない').toBeTruthy();
    expect(decideBtn.disabled, '色変更後もカテゴリが選択されたままでボタンが活性化しているはず').toBe(false);
    decideBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(renderKwClassifyList, 'renderKwClassifyList (呼び出し元リストの再描画) が呼ばれていない').toHaveBeenCalledTimes(1);
    expect(colorAtRenderTime, 'renderKwClassifyList実行時点でサーバー側の色が新しい値に更新されていない').toBe(newSwatch.dataset.color);
  });
});
