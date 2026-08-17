// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットの「🔗 サブクエリ」モーダル(subqueriesListBody)の中分類カテゴリ
// バッジ(.kw-cat-summary-badge)の色分けを、「🔑 キーワード分類」モーダル
// (kwClassifyListBody)のapplyKwBadgeColorsと同じ方式(各カテゴリ自身の色を
// border/color/CSS変数に反映し、大分類選択時は非所属カテゴリをKW_CAT_DIM_COLORで
// 暗色化)に統一する。
//
// 故障シナリオ:
//   (1) サブクエリ一覧モーダルの中分類バッジが常に灰色固定(var(--text-muted))の
//       ままで、キーワード分類モーダルと見た目が揃わない
//   (2) 大分類カテゴリを選択しても、その大分類に属さない中分類カテゴリの
//       バッジが暗色化されず区別がつかない

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

describe('サブクエリ一覧モーダル: 中分類カテゴリバッジの色分けロジック', () => {
  it('renderSubqueriesListが各カテゴリの色をborderColor/colorに反映し、大分類選択時は非所属を暗色化する', () => {
    const html = buildPage();
    const idx = html.indexOf('function renderSubqueriesList');
    expect(idx).toBeGreaterThan(-1);
    const endIdx = html.indexOf('subqueriesAddBtn.addEventListener', idx);
    const fn = endIdx > idx ? html.slice(idx, endIdx) : html.slice(idx, idx + 6000);

    const catBadgeBlockIdx = fn.indexOf("querySelectorAll('.kw-cat-summary-badge')");
    expect(catBadgeBlockIdx).toBeGreaterThan(-1);
    const catBadgeBlock = fn.slice(catBadgeBlockIdx, catBadgeBlockIdx + 900);
    expect(catBadgeBlock).toContain('sqSelectedGroupId');
    expect(catBadgeBlock).toContain('isDimmed');
    expect(catBadgeBlock).toContain('KW_CAT_DIM_COLOR');
    expect(catBadgeBlock).toContain('kw-cat-badge-dimmed');
    expect(catBadgeBlock).toContain('borderColor');
  });
});

describe('サブクエリ一覧モーダル(DOM実動作): 大分類選択時の中分類バッジ色', () => {
  async function setupSubqueriesModal() {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));

    const sqResponse = { items: [] };
    const kwResponse = { keywords: [] };
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
      if (u.includes('/api/aichat/subqueries')) {
        return Promise.resolve({ json: () => Promise.resolve(sqResponse) });
      }
      if (u.includes('/api/aichat/keyword-categories-summary')) {
        return Promise.resolve({ json: () => Promise.resolve(catsResponse) });
      }
      if (u.includes('/api/aichat/category-groups')) {
        return Promise.resolve({ json: () => Promise.resolve(groupsResponse) });
      }
      if (u.includes('/api/aichat/all-keywords')) {
        return Promise.resolve({ json: () => Promise.resolve(kwResponse) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    const subqueriesBtn = document.getElementById('subqueriesBtn') as HTMLButtonElement;
    subqueriesBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  it('大分類バッジを選択すると、属さない中分類カテゴリバッジがKW_CAT_DIM_COLORになり、属するバッジは元の色のまま', async () => {
    await setupSubqueriesModal();

    const groupBadge = document.querySelector('.kw-group-summary-badge[data-group-id="g1"]') as HTMLElement;
    expect(groupBadge).not.toBeNull();
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const catBadges = Array.from(document.querySelectorAll('.kw-cat-summary-badge')) as HTMLElement[];
    const byId = (id: string) => catBadges.find((el) => el.dataset.catId === id)!;

    expect(byId('1').style.borderColor).toBe('rgb(59, 130, 246)');
    expect(byId('2').style.borderColor).toBe('rgb(34, 197, 94)');
    expect(byId('1').classList.contains('kw-cat-badge-dimmed')).toBe(false);
    expect(byId('2').classList.contains('kw-cat-badge-dimmed')).toBe(false);

    expect(byId('3').style.borderColor).toBe('rgb(100, 116, 139)');
    expect(byId('3').classList.contains('kw-cat-badge-dimmed')).toBe(true);
  });

  it('大分類バッジの選択を解除すると、暗色化していたバッジが元のカテゴリ色に戻る', async () => {
    await setupSubqueriesModal();

    const groupBadge = document.querySelector('.kw-group-summary-badge[data-group-id="g1"]') as HTMLElement;
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const catBadges = Array.from(document.querySelectorAll('.kw-cat-summary-badge')) as HTMLElement[];
    const byId = (id: string) => catBadges.find((el) => el.dataset.catId === id)!;

    expect(byId('3').style.borderColor).toBe('rgb(249, 115, 22)');
    expect(byId('3').classList.contains('kw-cat-badge-dimmed')).toBe(false);
  });
});
