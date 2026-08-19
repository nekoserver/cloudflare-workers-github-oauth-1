// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの回答モーダルで、既にベクタ化済み(かつ
// キーワード登録済み)の回答文に表示される「キーワード一覧」ボタンの右側の
// 「再チェック」ボタン(#answerModalKeywordRecheckBtn)。
//
// この回答文からベクタ化時に過去に抽出したキーワード群(aichat_answer_
// keyword_vectors、/api/aichat/answer-keywordsのkeywords)全件について、
// 現在も未登録のままかどうかをチェックし、1件でも未登録があれば
// ベクタ化直後と同じ「一括登録」処理(runBulkRegister/
// bulkRegisterUnregisteredKeywords)を自動的に実行する。
//
// 故障シナリオ:
//   (1) ベクタ化済み・キーワード登録済みの回答でもボタンが表示されない
//   (2) 未ベクタ化、またはキーワード未登録の回答でボタンが表示されてしまう
//   (3) 押しても/api/aichat/answer-keywordsが呼ばれず、常に古いキャッシュを
//       使ってしまう(キャッシュを使うと未登録への変化を検知できない)
//   (4) 未登録キーワードが1件でもあるのに一括登録(open-modal/approve)が
//       自動実行されない
//   (5) 全キーワードが登録済みの場合でも不要に一括登録を実行してしまう
//   (6) 通信エラー時にボタンが無効化されたままになる

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

async function setupRecheckTest(opts: {
  keywordsRegistered?: boolean;
  vectorized?: boolean;
  answerKeywords?: string[];
  allKeywordCounts?: Record<string, number>;
} = {}) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });
  const shareResponse = {
    id: 's1', question: '質問文', answer: '回答文', model: 'model-a',
    created_at: '2026-08-02T09:30:00.000Z', access_count: 3, user_hash: 'hash123',
    input_tokens: 10, output_tokens: 20,
    vectorized: opts.vectorized ?? true,
    keywordsRegistered: opts.keywordsRegistered ?? true,
  };
  const answerKeywords = opts.answerKeywords ?? ['新幹線', '乗車券'];
  const allKeywordCounts = opts.allKeywordCounts ?? {};

  const calls: Array<{ kind: string; url: string; body: unknown }> = [];
  const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
    const u = String(url);
    const body = init && init.body ? JSON.parse(init.body) : null;
    if (u.includes('/api/aichat/all-keywords')) {
      calls.push({ kind: 'all-keywords', url: u, body });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        keywords: Object.keys(allKeywordCounts).map((kw) => ({ keyword: kw, cnt: allKeywordCounts[kw] })),
      }) });
    }
    if (u.includes('/api/aichat/answer-keywords')) {
      calls.push({ kind: 'answer-keywords', url: u, body });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        shareId: 's1', keywords: answerKeywords,
        keywordOccurrences: answerKeywords.map((kw) => ({ keyword: kw, count: allKeywordCounts[kw] || 0, classified: false, categoryColor: null })),
      }) });
    }
    if (u.includes('/api/aichat/shares/search')) {
      calls.push({ kind: 'search', url: u, body });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results: [] }) });
    }
    if (u.includes('/api/aichat/search-log/open-modal')) {
      calls.push({ kind: 'open-modal', url: u, body });
      const reqShareIds = (body as { shareIds?: string[] } | null)?.shareIds ?? [];
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        entries: reqShareIds.map((id) => ({ shareId: id, model: 'm', question: 'q', isNew: true })),
      }) });
    }
    if (u.includes('/api/aichat/search-log/approve')) {
      calls.push({ kind: 'approve', url: u, body });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, count: 1 }) });
    }
    if (u.includes('share-keywords')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ keywords: [] }) });
    }
    if (u.includes('/api/aichat/shares/')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(shareResponse) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('alert', vi.fn());

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
  // loadCatQuickNav()内のall-keywords取得(keywordCountMapの初期化)が
  // 完了するのを待つ
  await new Promise((resolve) => setTimeout(resolve, 10));

  return { calls };
}

function openAnswerModalViaClick(shareId: string) {
  const q = document.createElement('a');
  q.className = 'question-line';
  q.setAttribute('data-share-id', shareId);
  document.body.appendChild(q);
  q.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  q.remove();
}

describe('回答モーダル(DOM実動作): 「キーワード一覧」右の「再チェック」ボタン', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('ベクタ化済み・キーワード登録済みの回答では「キーワード一覧」と並んで表示される', async () => {
    await setupRecheckTest();
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const listBtn = document.getElementById('answerModalKeywordListBtn') as HTMLElement;
    const recheckBtn = document.getElementById('answerModalKeywordRecheckBtn') as HTMLElement;
    expect(listBtn.style.display).not.toBe('none');
    expect(recheckBtn.style.display).not.toBe('none');
  });

  it('未ベクタ化の回答では表示されない', async () => {
    await setupRecheckTest({ vectorized: false, keywordsRegistered: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const recheckBtn = document.getElementById('answerModalKeywordRecheckBtn') as HTMLElement;
    expect(recheckBtn.style.display).toBe('none');
  });

  it('ベクタ化済みだがキーワード未登録の回答では表示されない', async () => {
    await setupRecheckTest({ vectorized: true, keywordsRegistered: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const recheckBtn = document.getElementById('answerModalKeywordRecheckBtn') as HTMLElement;
    expect(recheckBtn.style.display).toBe('none');
  });

  it('未登録キーワードが1件でもあれば、押すだけで一括登録(open-modal→approve)まで自動的に実行される', async () => {
    // 新幹線は登録済み(cnt>0)、乗車券は未登録(cnt無し)
    const { calls } = await setupRecheckTest({ allKeywordCounts: { '新幹線': 3 } });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalKeywordRecheckBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    // キャッシュ(キーワード一覧)ではなく常に最新をDBへ問い合わせる
    expect(calls.some((c) => c.kind === 'answer-keywords')).toBe(true);

    const norimonoApprove = calls.find((c) => c.kind === 'approve' && (c.body as { keyword?: string }).keyword === '乗車券');
    expect(norimonoApprove).toBeDefined();
    // 登録済み(新幹線)については一括登録が呼ばれない
    const shinkansenApprove = calls.find((c) => c.kind === 'approve' && (c.body as { keyword?: string }).keyword === '新幹線');
    expect(shinkansenApprove).toBeUndefined();

    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('再チェック');
  });

  it('全キーワードが既に登録済みなら一括登録(open-modal/approve)は実行されない', async () => {
    const { calls } = await setupRecheckTest({ allKeywordCounts: { '新幹線': 3, '乗車券': 1 } });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalKeywordRecheckBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(calls.some((c) => c.kind === 'open-modal')).toBe(false);
    expect(calls.some((c) => c.kind === 'approve')).toBe(false);
  });

  it('通信エラー時はアラートを出しボタンを再度押せる状態に戻す', async () => {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ({
      clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    });
    const shareResponse = {
      id: 's1', question: '質問文', answer: '回答文', model: 'model-a', vectorized: true, keywordsRegistered: true,
    };
    const alertMock = vi.fn();
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/answer-keywords')) return Promise.reject(new Error('network error'));
      if (u.includes('share-keywords')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ keywords: [] }) });
      if (u.includes('/api/aichat/shares/')) return Promise.resolve({ ok: true, json: () => Promise.resolve(shareResponse) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('alert', alertMock);
    const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();
    await new Promise((resolve) => setTimeout(resolve, 10));

    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalKeywordRecheckBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(alertMock).toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('再チェック');
  });
});
