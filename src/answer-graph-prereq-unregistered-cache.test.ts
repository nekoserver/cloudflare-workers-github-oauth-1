// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの「この回答文をベクタ化する」/「キーワード抽出」
// ボタンで抽出された「この回答文を理解するのに必要な予備知識」チップ
// (#prereqModalBody 内の .prereq-modal-chip)。各キーワードがデータベースに
// 登録済みかどうかを、DBへ問い合わせず「この回答文のキーワード:」バーの
// バッジ処理時に作成済みのキャッシュ(keywordCountMap、
// /api/aichat/all-keywordsの取得結果)に対する完全一致の存在判定だけで
// 決め、未登録キーワードにはchip-unregisteredクラスを付け、一括登録ボタン
// (#prereqBulkRegisterBtn)を出す。
//
// 故障シナリオ:
//   (1) キャッシュに存在するキーワードにも誤ってchip-unregisteredが付き、
//       不要な一括登録対象になってしまう
//   (2) キャッシュに存在しないキーワードにchip-unregisteredが付かず、
//       一括登録の対象から漏れる
//   (3) 部分一致(前方一致・部分文字列)で誤って「登録済み」と判定してしまう
//       (完全一致でなければならない)
//   (4) 判定のために/api/aichat/answer-keywords等へ追加の問い合わせが
//       発生してしまう

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

async function setupPrereqUnregisteredCacheTest(vectorizeResponseOverrides: Record<string, unknown> = {}) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const extraFetchCalls: string[] = [];
  const fetchMock = vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/api/aichat/vectorize-answer')) {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({
          vectorized: true, model: '@cf/pfnet/plamo-embedding-1b', dim: 3,
          keywords: ['東京駅', '新幹線', '乗車券'],
          _keywordsWarning: null,
          ...vectorizeResponseOverrides,
        }),
      });
    }
    if (u.includes('/api/aichat/all-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [
        { keyword: '東京駅', cnt: 5, category_id: 1 },
        { keyword: '駅', cnt: 2 },
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
    if (u.includes('/api/aichat/answer-keywords')) {
      extraFetchCalls.push(u);
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('alert', vi.fn());

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  // loadCatQuickNav()の完了(keywordCountMapの構築)を待つ
  await new Promise((resolve) => setTimeout(resolve, 10));

  const q = document.createElement('a');
  q.className = 'question-line';
  q.setAttribute('data-share-id', 's1');
  document.body.appendChild(q);
  q.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  q.remove();
  await new Promise((resolve) => setTimeout(resolve, 10));

  const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));

  return { fetchMock, extraFetchCalls };
}

describe('予備知識モーダル(DOM実動作): チップの未登録判定はキャッシュの完全一致のみで行う', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('キャッシュ(keywordCountMap)に存在するキーワードのチップにはchip-unregisteredが付かない', async () => {
    await setupPrereqUnregisteredCacheTest();
    const chips = Array.from(document.querySelectorAll('.prereq-modal-chip'));
    const tokyoChip = chips.find((c) => c.textContent === '東京駅') as HTMLElement;
    expect(tokyoChip.classList.contains('chip-unregistered')).toBe(false);
  });

  it('キャッシュに存在しないキーワードのチップにはchip-unregisteredが付き、一括登録ボタンの行が表示される', async () => {
    await setupPrereqUnregisteredCacheTest();
    const chips = Array.from(document.querySelectorAll('.prereq-modal-chip'));
    const shinkansenChip = chips.find((c) => c.textContent === '新幹線') as HTMLElement;
    const ticketChip = chips.find((c) => c.textContent === '乗車券') as HTMLElement;
    expect(shinkansenChip.classList.contains('chip-unregistered')).toBe(true);
    expect(ticketChip.classList.contains('chip-unregistered')).toBe(true);

    const foot = document.getElementById('prereqModalFoot')!;
    expect(foot.style.display).not.toBe('none');
  });

  it('部分一致では登録済みと判定しない(完全一致のみ)', async () => {
    // キャッシュには「駅」はあるが「東京駅」とは完全一致しないキーワードで確認する
    await setupPrereqUnregisteredCacheTest({ keywords: ['駅前'] });
    const chips = Array.from(document.querySelectorAll('.prereq-modal-chip'));
    const chip = chips.find((c) => c.textContent === '駅前') as HTMLElement;
    expect(chip.classList.contains('chip-unregistered')).toBe(true);
  });

  it('未登録判定のために追加のDB問い合わせ(/api/aichat/answer-keywords等)は発生しない', async () => {
    const { extraFetchCalls } = await setupPrereqUnregisteredCacheTest();
    expect(extraFetchCalls).toHaveLength(0);
  });
});
