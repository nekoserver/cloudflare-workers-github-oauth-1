// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの「この回答文を理解するのに必要な予備知識」
// モーダルで、抽出されたキーワードを1件ずつ中抜き枠でハイライトしながら
// 進む演出(animateKeywordVectorizationProgress/.chip-vectorizing)。
// 登録済み(出現回数が0でない)かつ分類済み(中分類カテゴリの色が
// 割り当て済み)のキーワードは、既定の強調色の代わりにそのカテゴリ色で
// 中抜き枠を塗りながらカウンタを進める。
//
// 故障シナリオ:
//   (1) 登録済み・分類済みのキーワードでもカテゴリ色が使われず既定色のまま
//       ハイライトされてしまう
//   (2) 未登録(出現回数0)または未分類のキーワードにまでカテゴリ色相当の
//       枠色が付いてしまう
//   (3) ハイライトが次のチップへ進んだ後も前のチップに色が残ってしまう
//       (中抜き強調を外した後の色のクリア漏れ)

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

async function setupChipVectorizingColorTest() {
  vi.useFakeTimers();
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/vectorize-answer')) {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({
          vectorized: true, model: '@cf/pfnet/plamo-embedding-1b', dim: 3,
          keywords: ['東京駅', '新幹線', '乗車券'],
          keywordVectorization: [
            { keyword: '東京駅', alreadyRegistered: true },
            { keyword: '新幹線', alreadyRegistered: false },
            { keyword: '乗車券', alreadyRegistered: false },
          ],
          _keywordsWarning: null,
        }),
      });
    }
    if (u.includes('/api/aichat/all-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [
        { keyword: '東京駅', cnt: 5, category_id: 1 },
        { keyword: '新幹線', cnt: 3 },
      ] }) });
    }
    if (u.includes('/api/aichat/category-groups')) {
      return Promise.resolve({ json: () => Promise.resolve({ groups: [] }) });
    }
    if (u.includes('/api/aichat/keyword-categories-summary')) {
      return Promise.resolve({ json: () => Promise.resolve({ categories: [{ id: 1, name: '交通', color: '#3b82f6' }] }) });
    }
    if (u.includes('share-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [] }) });
    }
    if (u.includes('/api/aichat/shares/')) {
      return Promise.resolve({ json: () => Promise.resolve({ id: 's1', question: 'Q', answer: 'A', vectorized: false }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('alert', vi.fn());

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  await vi.advanceTimersByTimeAsync(10);

  const q = document.createElement('a');
  q.className = 'question-line';
  q.setAttribute('data-share-id', 's1');
  document.body.appendChild(q);
  q.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  q.remove();
  await vi.advanceTimersByTimeAsync(10);

  const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  document.getElementById('vecModelModalOkBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await vi.advanceTimersByTimeAsync(10);

  const chips = Array.from(document.querySelectorAll('.prereq-modal-chip')) as HTMLElement[];
  return { chips };
}

describe('予備知識モーダル(DOM実動作): 中抜き強調ループでの登録済み・分類済みキーワードのカテゴリ色塗り', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('登録済み(出現回数≠0)かつ分類済み(色割り当て済み)のキーワードは中抜き枠にカテゴリ色が塗られる', async () => {
    const { chips } = await setupChipVectorizingColorTest();
    const tokyoChip = chips.find((c) => c.textContent === '東京駅')!;

    expect(tokyoChip.classList.contains('chip-vectorizing')).toBe(true);
    expect(tokyoChip.style.borderColor).toBe('rgb(59, 130, 246)');
  });

  it('登録済みだが未分類(色未割り当て)のキーワードには既定の強調色のまま(インラインの色指定なし)', async () => {
    const { chips } = await setupChipVectorizingColorTest();
    await vi.advanceTimersByTimeAsync(220);
    const shinkansenChip = chips.find((c) => c.textContent === '新幹線')!;

    expect(shinkansenChip.classList.contains('chip-vectorizing')).toBe(true);
    expect(shinkansenChip.style.borderColor).toBe('');
  });

  it('未登録(出現回数0)のキーワードにはカテゴリ色相当の枠色が付かない', async () => {
    const { chips } = await setupChipVectorizingColorTest();
    await vi.advanceTimersByTimeAsync(220 * 2);
    const ticketChip = chips.find((c) => c.textContent === '乗車券')!;

    expect(ticketChip.classList.contains('chip-vectorizing')).toBe(true);
    expect(ticketChip.style.borderColor).toBe('');
  });

  it('次のチップへ進むと前のチップの中抜き強調・色指定が外れる', async () => {
    const { chips } = await setupChipVectorizingColorTest();
    const tokyoChip = chips.find((c) => c.textContent === '東京駅')!;
    expect(tokyoChip.style.borderColor).toBe('rgb(59, 130, 246)');

    await vi.advanceTimersByTimeAsync(220);
    expect(tokyoChip.classList.contains('chip-vectorizing')).toBe(false);
    expect(tokyoChip.style.borderColor).toBe('');
  });
});
