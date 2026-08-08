// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットの「🔑 キーワード分類」モーダル(kwClassifyListBody)で、
// 大分類カテゴリバッジ(.kw-group-summary-badge)を選んだ際に中分類カテゴリ
// バッジ(.kw-cat-summary-badge)を色分けする applyKwBadgeColors。
//
// 故障シナリオ:
//   (1) 大分類カテゴリを選択しても、その大分類に属さない中分類カテゴリの
//       バッジが元の(あらかじめ設定された)カテゴリ色のまま表示され、
//       属する中分類カテゴリと見分けがつかない
//   (2) 大分類カテゴリの選択を解除しても、暗くなった中分類カテゴリバッジが
//       元の色に戻らない

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('キーワード分類モーダル: 大分類選択時の非所属中分類カテゴリの暗色化', () => {
  it('applyKwBadgeColorsがselectedGroupId・selectedCatsを見て非所属カテゴリを暗色(KW_CAT_DIM_COLOR)にする', () => {
    const html = buildPage();
    const idx = html.indexOf('function applyKwBadgeColors');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('function renderKwClassifyList');
    expect(endIdx).toBeGreaterThan(idx);
    const fn = html.slice(idx, endIdx);

    const catBadgeBlockIdx = fn.indexOf('kw-cat-summary-badge');
    expect(catBadgeBlockIdx).toBeGreaterThan(-1);
    const catBadgeBlock = fn.slice(catBadgeBlockIdx);
    expect(catBadgeBlock).toContain('selectedGroupId');
    expect(catBadgeBlock).toContain('isDimmed');
    expect(catBadgeBlock).toContain('KW_CAT_DIM_COLOR');
    expect(catBadgeBlock).toContain('kw-cat-badge-dimmed');
  });

  it('KW_CAT_DIM_COLOR定数が定義されている', () => {
    const html = buildPage();
    expect(html).toContain('KW_CAT_DIM_COLOR');
  });

  it('.kw-cat-badge-dimmedのCSSが定義されている', () => {
    const html = buildPage();
    expect(html).toContain('.kw-cat-badge-dimmed');
  });
});

describe('キーワード分類モーダル(DOM実動作): 大分類選択時の中分類バッジ色', () => {
  async function setupClassifyModal() {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));

    const catsResponse = {
      categories: [
        { id: 1, name: '交通', color: '#3b82f6', kw_count: 2 },
        { id: 2, name: '観光', color: '#22c55e', kw_count: 1 },
        { id: 3, name: 'グルメ', color: '#f97316', kw_count: 1 },
      ],
    };
    const groupsResponse = {
      groups: [
        { id: 'g1', group_name: '旅行系', kw_count: 3, category_ids: [1, 2] },
      ],
    };

    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/keyword-categories-summary')) {
        return Promise.resolve({ json: () => Promise.resolve(catsResponse) });
      }
      if (u.includes('/api/aichat/category-groups')) {
        return Promise.resolve({ json: () => Promise.resolve(groupsResponse) });
      }
      if (u.includes('/api/aichat/all-keywords')) {
        return Promise.resolve({ json: () => Promise.resolve({ keywords: [] }) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    const kwClassifyBtn = document.getElementById('kwClassifyBtn') as HTMLButtonElement;
    kwClassifyBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  it('大分類バッジを選択すると、属さない中分類カテゴリバッジがKW_CAT_DIM_COLORになり、属するバッジは元の色のまま', async () => {
    await setupClassifyModal();

    const groupBadge = document.querySelector('.kw-group-summary-badge[data-group-id="g1"]') as HTMLElement;
    expect(groupBadge).not.toBeNull();
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const catBadges = Array.from(document.querySelectorAll('.kw-cat-summary-badge')) as HTMLElement[];
    const byId = (id: string) => catBadges.find((el) => el.dataset.catId === id)!;

    // 交通・観光は大分類「旅行系」に属する → 元のカテゴリ色のまま
    expect(byId('1').style.borderColor).toBe('rgb(59, 130, 246)');
    expect(byId('2').style.borderColor).toBe('rgb(34, 197, 94)');
    expect(byId('1').classList.contains('kw-cat-badge-dimmed')).toBe(false);
    expect(byId('2').classList.contains('kw-cat-badge-dimmed')).toBe(false);

    // グルメは属さない → 暗色(KW_CAT_DIM_COLOR = #64748b)になる
    expect(byId('3').style.borderColor).toBe('rgb(100, 116, 139)');
    expect(byId('3').classList.contains('kw-cat-badge-dimmed')).toBe(true);
  });

  it('大分類バッジの選択を解除すると、暗色化していたバッジが元のカテゴリ色に戻る', async () => {
    await setupClassifyModal();

    const groupBadge = document.querySelector('.kw-group-summary-badge[data-group-id="g1"]') as HTMLElement;
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true })); // もう一度押して選択解除

    const catBadges = Array.from(document.querySelectorAll('.kw-cat-summary-badge')) as HTMLElement[];
    const byId = (id: string) => catBadges.find((el) => el.dataset.catId === id)!;

    expect(byId('3').style.borderColor).toBe('rgb(249, 115, 22)');
    expect(byId('3').classList.contains('kw-cat-badge-dimmed')).toBe(false);
  });
});
