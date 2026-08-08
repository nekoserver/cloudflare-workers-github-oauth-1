// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページの回答モーダル(#answerModalBackdrop)にある
// 「この回答文をベクタ化する」ボタン(#answerModalVectorizeBtn)と、
// 押した結果を表示する最上位レイヤーの予備知識モーダル(#prereqModalBackdrop)。
//
// 故障シナリオ:
//   (1) ベクタ化済み(vectorized:true)の回答でもボタンが表示されたままになる
//   (2) 未ベクタ化の回答でボタンが表示されない
//   (3) ボタンを押しても/api/aichat/vectorize-answerが呼ばれない、または
//       shareIdが正しく渡らない
//   (4) 抽出されたキーワードが予備知識モーダルに表示されない、または
//       回答モーダルより手前(最上位)に表示されない
//   (5) ベクタ化成功後もボタンが表示されたままになる(再度押せてしまう)
//   (6) APIがエラーを返してもボタンが無効化されたまま(再試行できない)

function buildPage(): string {
  return getAnswerGraphPage('testuser', {}, false);
}

async function setupVectorizeButtonTest(shareResponseOverrides: Record<string, unknown> = {}) {
  const html = buildPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ({
    clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
  });

  const shareResponse = {
    id: 's1',
    question: '質問文',
    answer: '回答文',
    model: 'model-a',
    created_at: '2026-08-02T09:30:00.000Z',
    access_count: 3,
    user_hash: 'hash123',
    input_tokens: 10,
    output_tokens: 20,
    vectorized: false,
    ...shareResponseOverrides,
  };

  const vectorizeCalls: Array<{ url: string; body: unknown }> = [];
  const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
    const u = String(url);
    if (u.includes('/api/aichat/vectorize-answer')) {
      vectorizeCalls.push({ url: u, body: init && init.body ? JSON.parse(init.body) : null });
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ vectorized: true, model: '@cf/pfnet/plamo-embedding-1b', dim: 3, keywords: ['東京駅', '新幹線'], _keywordsWarning: null }),
      });
    }
    if (u.includes('share-keywords')) {
      return Promise.resolve({ json: () => Promise.resolve({ keywords: [] }) });
    }
    if (u.includes('/api/aichat/shares/')) {
      return Promise.resolve({ json: () => Promise.resolve(shareResponse) });
    }
    return Promise.resolve({ json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('alert', vi.fn());

  const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();

  return { fetchMock, vectorizeCalls };
}

function openAnswerModalViaClick(shareId: string) {
  const q = document.createElement('a');
  q.className = 'question-line';
  q.setAttribute('data-share-id', shareId);
  document.body.appendChild(q);
  q.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  q.remove();
}

describe('回答モーダル(DOM実動作): 「この回答文をベクタ化する」ボタンと予備知識モーダル', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('未ベクタ化(vectorized:false)の回答ではボタンが表示される', async () => {
    await setupVectorizeButtonTest({ vectorized: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    expect(btn.style.display).not.toBe('none');
  });

  it('ベクタ化済み(vectorized:true)の回答ではボタンが表示されない', async () => {
    await setupVectorizeButtonTest({ vectorized: true });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    expect(btn.style.display).toBe('none');
  });

  it('ボタンを押すと/api/aichat/vectorize-answerへ現在開いているshareIdがPOSTされる', async () => {
    const { vectorizeCalls } = await setupVectorizeButtonTest({ vectorized: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vectorizeCalls).toHaveLength(1);
    expect(vectorizeCalls[0].body).toEqual({ shareId: 's1' });
  });

  it('ベクタ化成功後、抽出されたキーワードが予備知識モーダルに表示され、モーダルが開く', async () => {
    await setupVectorizeButtonTest({ vectorized: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const prereqBackdrop = document.getElementById('prereqModalBackdrop')!;
    expect(prereqBackdrop.classList.contains('open')).toBe(true);
    const chips = Array.from(prereqBackdrop.querySelectorAll('.prereq-modal-chip')).map((el) => el.textContent);
    expect(chips).toEqual(['東京駅', '新幹線']);
  });

  it('ベクタ化成功後はボタンが非表示になる(連打防止)', async () => {
    await setupVectorizeButtonTest({ vectorized: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(btn.style.display).toBe('none');
  });

  it('予備知識モーダルは、回答モーダルより手前(z-indexが高い)に表示される', () => {
    const html = buildPage();
    const answerZIdx = html.indexOf('.answer-modal-backdrop {');
    const answerBlock = html.slice(answerZIdx, answerZIdx + 200);
    const answerZMatch = answerBlock.match(/z-index:(\d+)/);
    const prereqZIdx = html.indexOf('.prereq-modal-backdrop {');
    const prereqBlock = html.slice(prereqZIdx, prereqZIdx + 200);
    const prereqZMatch = prereqBlock.match(/z-index:(\d+)/);
    expect(answerZMatch).not.toBeNull();
    expect(prereqZMatch).not.toBeNull();
    expect(Number(prereqZMatch![1])).toBeGreaterThan(Number(answerZMatch![1]));
  });

  it('keywordVectorizationを受け取ると、チップに1件ずつchip-vectorizingクラスが付いて進む(中抜き強調のループ演出)', async () => {
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

    openAnswerModalViaClick('s1');
    await vi.advanceTimersByTimeAsync(10);

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);

    const chips = Array.from(document.querySelectorAll('.prereq-modal-chip'));
    expect(chips).toHaveLength(3);

    // 1件目がハイライトされた直後の状態
    expect(chips[0].classList.contains('chip-vectorizing')).toBe(true);
    expect(chips[1].classList.contains('chip-vectorizing')).toBe(false);
    expect(chips[2].classList.contains('chip-vectorizing')).toBe(false);

    // ループが進むと1件目は外れ、2件目がハイライトされる
    await vi.advanceTimersByTimeAsync(220);
    expect(chips[0].classList.contains('chip-vectorizing')).toBe(false);
    expect(chips[1].classList.contains('chip-vectorizing')).toBe(true);
    expect(chips[2].classList.contains('chip-vectorizing')).toBe(false);

    // 最後まで進めるとどのチップにもクラスが残らない
    await vi.advanceTimersByTimeAsync(220);
    await vi.advanceTimersByTimeAsync(220);
    chips.forEach((chip) => expect(chip.classList.contains('chip-vectorizing')).toBe(false));

    vi.useRealTimers();
  });

  it('APIがエラーを返した場合、ボタンは再度押せる状態に戻る', async () => {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ({
      clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    });
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/vectorize-answer')) {
        return Promise.resolve({ status: 500, json: () => Promise.resolve({ error: 'ベクタ化に失敗しました: テストエラー' }) });
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

    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(btn.disabled).toBe(false);
    expect(btn.style.display).not.toBe('none');
  });
});
