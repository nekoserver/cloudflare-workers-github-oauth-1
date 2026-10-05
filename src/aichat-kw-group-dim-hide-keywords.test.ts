// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { getAiChatPage } from './views/aichat';

// 対象: AIチャットの「🔑 キーワード分類」モーダルで、大分類カテゴリを選択した
// 際に、その大分類に属さない(グレーアウトされた)中分類カテゴリのキーワードを
// 画面下のバッジ群エリアから一旦排除する applyKwBadgeColors の拡張。
//
// 故障シナリオ:
//   (1) グレーアウトされた中分類に属するキーワードが排除されず表示され続ける
//   (2) 複数カテゴリに属すキーワードが、1つでも非グレーアウトのカテゴリに
//       属していれば表示されるべきなのに、誤って排除されてしまう
//   (3) 未分類キーワード(どのカテゴリにも属さない)が誤って排除されてしまう
//   (4) 大分類の選択を解除しても、排除されたキーワードが再表示されない
//   (5) 検索窓によるフィルタと組み合わさったときに、互いの条件を上書きしてしまう

function buildPage(): string {
  return getAiChatPage({
    username: 'testuser',
    aiChatModel: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}

async function setupClassifyModal() {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));

  const catsResponse = {
    categories: [
      { id: 1, name: '交通', color: '#3b82f6', kw_count: 1 },
      { id: 2, name: '観光', color: '#22c55e', kw_count: 1 },
      { id: 3, name: 'グルメ', color: '#f97316', kw_count: 1 },
    ],
  };
  const groupsResponse = {
    groups: [{ id: 'g1', group_name: '旅行系', kw_count: 2, category_ids: [1, 2] }],
  };
  const keywordsResponse = {
    keywords: [
      { keyword: '新幹線', cnt: 3, is_classified: true, category_id: 1, category_color: '#3b82f6' },
      { keyword: '温泉', cnt: 2, is_classified: true, category_id: 2, category_color: '#22c55e' },
      { keyword: 'ラーメン', cnt: 5, is_classified: true, category_id: 3, category_color: '#f97316' },
      { keyword: '未分類語', cnt: 1, is_classified: false },
      { keyword: '複合語', cnt: 1, is_classified: true, category_ids: '1:#3b82f6,3:#f97316' },
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
      return Promise.resolve({ json: () => Promise.resolve(keywordsResponse) });
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

function kwBadgeByText(text: string): HTMLElement {
  const els = Array.from(document.querySelectorAll('.kw-classify-kw-badge')) as HTMLElement[];
  return els.find((el) => (el.dataset.keyword || '') === text)!;
}

function isVisible(el: HTMLElement): boolean {
  return el.style.display !== 'none';
}

describe('キーワード分類モーダル: 大分類選択時に非所属カテゴリのキーワードをバッジ群から排除する', () => {
  it('大分類「旅行系」(交通・観光)を選ぶと、属さない「グルメ」のキーワードだけ非表示になる', async () => {
    await setupClassifyModal();
    const groupBadge = document.querySelector('.kw-group-summary-badge[data-group-id="g1"]') as HTMLElement;
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(isVisible(kwBadgeByText('新幹線'))).toBe(true);
    expect(isVisible(kwBadgeByText('温泉'))).toBe(true);
    expect(isVisible(kwBadgeByText('ラーメン'))).toBe(false);
  });

  it('未分類キーワードは大分類選択の影響を受けず表示され続ける', async () => {
    await setupClassifyModal();
    const groupBadge = document.querySelector('.kw-group-summary-badge[data-group-id="g1"]') as HTMLElement;
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(isVisible(kwBadgeByText('未分類語'))).toBe(true);
  });

  it('複数カテゴリに属すキーワードは、1つでも非グレーアウトのカテゴリに属していれば表示を維持する', async () => {
    await setupClassifyModal();
    const groupBadge = document.querySelector('.kw-group-summary-badge[data-group-id="g1"]') as HTMLElement;
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // 複合語は交通(選択中グループに属する)とグルメ(属さない)の両方に分類されている
    expect(isVisible(kwBadgeByText('複合語'))).toBe(true);
  });

  it('大分類の選択を解除すると、排除されていたキーワードが再表示される', async () => {
    await setupClassifyModal();
    const groupBadge = document.querySelector('.kw-group-summary-badge[data-group-id="g1"]') as HTMLElement;
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(isVisible(kwBadgeByText('ラーメン'))).toBe(false);

    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 再度押して解除
    expect(isVisible(kwBadgeByText('ラーメン'))).toBe(true);
  });

  it('検索窓によるフィルタと組み合わさっても、両方の条件を満たすキーワードだけ表示される', async () => {
    await setupClassifyModal();
    const groupBadge = document.querySelector('.kw-group-summary-badge[data-group-id="g1"]') as HTMLElement;
    groupBadge.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const searchInput = document.getElementById('kwClassifySearchInput') as HTMLInputElement;
    searchInput.value = 'ラーメン';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    // 検索語に一致するが、グレーアウトされたカテゴリのキーワードなので非表示のまま
    expect(isVisible(kwBadgeByText('ラーメン'))).toBe(false);

    searchInput.value = '新幹線';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(isVisible(kwBadgeByText('新幹線'))).toBe(true);
  });
});
