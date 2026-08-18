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
    document.getElementById('vecModelModalOkBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vectorizeCalls).toHaveLength(1);
    expect(vectorizeCalls[0].body).toEqual({ shareId: 's1', model: '@cf/pfnet/plamo-embedding-1b' });
  });

  it('ベクタ化成功後、抽出されたキーワードが予備知識モーダルに表示され、モーダルが開く', async () => {
    await setupVectorizeButtonTest({ vectorized: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('vecModelModalOkBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
    document.getElementById('vecModelModalOkBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
    document.getElementById('vecModelModalOkBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

  async function setupResultModalTest() {
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
            keywords: ['東京駅', '新幹線', '乗車券', '改札'],
            keywordVectorization: [
              { keyword: '東京駅', alreadyRegistered: true },
              { keyword: '新幹線', alreadyRegistered: false },
              { keyword: '乗車券', alreadyRegistered: false },
              { keyword: '改札', alreadyRegistered: false, error: 'AI down' },
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
    document.getElementById('vecModelModalOkBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(10);
    // チップのハイライトループ(4件 × 220ms)を最後まで進める
    await vi.advanceTimersByTimeAsync(220 * 4);
  }

  it('ループが終わると最上位レイヤーに結果モーダルが開き、新規追加/スキップ/総ベクタ化件数を表示する(エラー分は集計から除く)', async () => {
    vi.useFakeTimers();
    await setupResultModalTest();

    const resultBackdrop = document.getElementById('prereqResultModalBackdrop')!;
    expect(resultBackdrop.classList.contains('open')).toBe(true);
    const body = document.getElementById('prereqResultModalBody')!.textContent || '';
    expect(body).toContain('新規追加キーワード : 2件');
    expect(body).toContain('スキップ : 1件');
    expect(body).toContain('総ベクタ化キーワード : 3件');

    vi.useRealTimers();
  });

  it('「了解」ボタンを押すと結果モーダルが閉じる', async () => {
    vi.useFakeTimers();
    await setupResultModalTest();

    const okBtn = document.getElementById('prereqResultModalOkBtn') as HTMLButtonElement;
    okBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const resultBackdrop = document.getElementById('prereqResultModalBackdrop')!;
    expect(resultBackdrop.classList.contains('open')).toBe(false);

    vi.useRealTimers();
  });

  it('「了解」を押さなくても10秒経つと結果モーダルが自動的に閉じる', async () => {
    vi.useFakeTimers();
    await setupResultModalTest();

    const resultBackdrop = document.getElementById('prereqResultModalBackdrop')!;
    expect(resultBackdrop.classList.contains('open')).toBe(true);

    // 10秒未満ではまだ閉じない(チップのハイライトループ分の誤差を許容し余裕を持たせる)
    await vi.advanceTimersByTimeAsync(9000);
    expect(resultBackdrop.classList.contains('open')).toBe(true);

    // 10秒経過後は自動的に閉じている
    await vi.advanceTimersByTimeAsync(2000);
    expect(resultBackdrop.classList.contains('open')).toBe(false);

    vi.useRealTimers();
  });

  it('ボタンを押すとまず埋め込みモデル選択モーダルが開き、直後には/api/aichat/vectorize-answerを呼ばない', async () => {
    const { vectorizeCalls } = await setupVectorizeButtonTest({ vectorized: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(document.getElementById('vecModelModalBackdrop')!.classList.contains('open')).toBe(true);
    expect(vectorizeCalls).toHaveLength(0);
  });

  it('モデル選択モーダルで「キャンセル」を押すと閉じて何も送信されない', async () => {
    const { vectorizeCalls } = await setupVectorizeButtonTest({ vectorized: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('vecModelModalCancelBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(document.getElementById('vecModelModalBackdrop')!.classList.contains('open')).toBe(false);
    expect(vectorizeCalls).toHaveLength(0);
  });

  it('モデル選択モーダルで選んだモデルがリクエストボディのmodelに反映される', async () => {
    const { vectorizeCalls } = await setupVectorizeButtonTest({ vectorized: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalVectorizeBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const bgeRadio = document.querySelector('input[name="vecModelChoice"][value="@cf/baai/bge-m3"]') as HTMLInputElement;
    bgeRadio.checked = true;
    document.getElementById('vecModelModalOkBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vectorizeCalls).toHaveLength(1);
    expect(vectorizeCalls[0].body).toEqual({ shareId: 's1', model: '@cf/baai/bge-m3' });
  });

  it('モデル未選択でも既定でplamo-embedding-1bのradioがcheckedになっている', () => {
    const html = buildPage();
    const idx = html.indexOf('id="vecModelModalBackdrop"');
    const block = html.slice(idx, idx + 900);
    expect(block).toContain('value="@cf/pfnet/plamo-embedding-1b" checked');
  });

  it('埋め込みモデルの一覧は一番上にplamo-embedding-1bが来る', () => {
    const html = buildPage();
    const idx = html.indexOf('id="vecModelModalBackdrop"');
    const block = html.slice(idx, idx + 900);
    const plamoIdx = block.indexOf('@cf/pfnet/plamo-embedding-1b');
    const bgeIdx = block.indexOf('@cf/baai/bge-m3');
    const gemmaIdx = block.indexOf('@cf/google/embeddinggemma-300m');
    expect(plamoIdx).toBeGreaterThan(-1);
    expect(plamoIdx).toBeLessThan(bgeIdx);
    expect(plamoIdx).toBeLessThan(gemmaIdx);
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
    document.getElementById('vecModelModalOkBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(btn.disabled).toBe(false);
    expect(btn.style.display).not.toBe('none');
  });
});

// 対象: ベクタ化済み(vectorized:true)の回答モーダルで、「この回答文を
// ベクタ化する」ボタンの代わりに表示する「ベクタ化済み」バッジと、
// キーワードの登録状況(keywordsRegistered)に応じて出し分ける
// 「キーワード一覧」/「キーワード抽出」ボタン。
//
// 故障シナリオ:
//   (1) ベクタ化済みなのに従来の「この回答文をベクタ化する」ボタンが
//       表示されたままになる
//   (2) keywordsRegistered:trueなのに「キーワード抽出」ボタンが出てしまう
//       (二重にAIを呼んでしまう導線になる)
//   (3) keywordsRegistered:falseなのに「キーワード一覧」ボタンが出てしまう
//       (空の一覧しか出せないボタンになる)
//   (4) 「キーワード抽出」ボタンを押しても/api/aichat/vectorize-answerが
//       呼ばれない
//   (5) 「キーワード一覧」ボタンを押しても登録済みキーワードが表示されない、
//       またはベクタ化ループ演出・結果モーダルが誤って出てしまう
describe('回答モーダル(DOM実動作): ベクタ化済みバッジとキーワード一覧/抽出ボタンの出し分け', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  async function setupBadgeTest(shareResponseOverrides: Record<string, unknown>) {
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
      ...shareResponseOverrides,
    };
    const answerKeywordsCalls: string[] = [];
    const vectorizeCalls: Array<{ body: unknown }> = [];
    const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
      const u = String(url);
      if (u.includes('/api/aichat/answer-keywords')) {
        answerKeywordsCalls.push(u);
        return Promise.resolve({ json: () => Promise.resolve({
          shareId: 's1', keywords: ['東京駅', '新幹線'],
          keywordOccurrences: [
            { keyword: '新幹線', count: 5, classified: true, categoryColor: '#3b82f6' },
            { keyword: '東京駅', count: 2, classified: false, categoryColor: null },
            { keyword: '乗車券', count: 0, classified: false, categoryColor: null },
          ],
        }) });
      }
      if (u.includes('/api/aichat/vectorize-answer')) {
        vectorizeCalls.push({ body: init && init.body ? JSON.parse(init.body) : null });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve({ vectorized: true, model: '@cf/pfnet/plamo-embedding-1b', dim: 3, keywords: ['乗車券'], keywordVectorization: [{ keyword: '乗車券', alreadyRegistered: false }], _keywordsWarning: null }),
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

    return { answerKeywordsCalls, vectorizeCalls };
  }

  it('未ベクタ化(vectorized:false)の場合はバッジ・キーワード一覧・キーワード抽出ボタンはすべて非表示', async () => {
    await setupBadgeTest({ vectorized: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect((document.getElementById('answerModalVectorizedBadge') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('answerModalKeywordListBtn') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('answerModalKeywordExtractBtn') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('answerModalVectorizeBtn') as HTMLElement).style.display).not.toBe('none');
  });

  it('ベクタ化済み・キーワード未登録(keywordsRegistered:false)の場合はバッジ+「キーワード抽出」ボタンを表示する', async () => {
    await setupBadgeTest({ vectorized: true, keywordsRegistered: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect((document.getElementById('answerModalVectorizeBtn') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('answerModalVectorizedBadge') as HTMLElement).style.display).not.toBe('none');
    expect((document.getElementById('answerModalKeywordExtractBtn') as HTMLElement).style.display).not.toBe('none');
    expect((document.getElementById('answerModalKeywordListBtn') as HTMLElement).style.display).toBe('none');
  });

  it('ベクタ化済み・キーワード登録済み(keywordsRegistered:true)の場合はバッジ+「キーワード一覧」ボタンを表示する', async () => {
    await setupBadgeTest({ vectorized: true, keywordsRegistered: true });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect((document.getElementById('answerModalVectorizeBtn') as HTMLElement).style.display).toBe('none');
    expect((document.getElementById('answerModalVectorizedBadge') as HTMLElement).style.display).not.toBe('none');
    expect((document.getElementById('answerModalKeywordListBtn') as HTMLElement).style.display).not.toBe('none');
    expect((document.getElementById('answerModalKeywordExtractBtn') as HTMLElement).style.display).toBe('none');
  });

  it('「キーワード抽出」ボタンを押すと/api/aichat/vectorize-answerが現在のshareIdでPOSTされ、予備知識モーダルが開く', async () => {
    const { vectorizeCalls } = await setupBadgeTest({ vectorized: true, keywordsRegistered: false });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalKeywordExtractBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('vecModelModalOkBtn')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(vectorizeCalls).toHaveLength(1);
    expect(vectorizeCalls[0].body).toEqual({ shareId: 's1', model: '@cf/pfnet/plamo-embedding-1b' });
    expect(document.getElementById('prereqModalBackdrop')!.classList.contains('open')).toBe(true);
    expect(btn.style.display).toBe('none');
  });

  it('「キーワード一覧」ボタンを押すと/api/aichat/answer-keywordsから出現回数付きのキーワード一覧を取得し、丸バッジで「キーワード (出現回数)」を表示する(0件は(0)を付けない・ループ演出/結果モーダルは出さない)', async () => {
    const { answerKeywordsCalls } = await setupBadgeTest({ vectorized: true, keywordsRegistered: true });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalKeywordListBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(answerKeywordsCalls).toHaveLength(1);
    expect(answerKeywordsCalls[0]).toContain('shareId=s1');
    const prereqBackdrop = document.getElementById('prereqModalBackdrop')!;
    expect(prereqBackdrop.classList.contains('open')).toBe(true);
    const badges = Array.from(prereqBackdrop.querySelectorAll('.prereq-kw-badge')) as HTMLElement[];
    expect(badges.map((el) => el.textContent)).toEqual(['新幹線 (5)', '東京駅 (2)', '乗車券']);

    // 分類済み(新幹線)はカテゴリ色で外枠を塗る
    expect(badges[0].style.borderColor).toBe('rgb(59, 130, 246)');
    // 未分類だが登録あり(東京駅)は未分類色(デフォルト#94a3b8)で外枠を塗る
    expect(badges[1].style.borderColor).toBe('rgb(148, 163, 184)');
    // 出現回数0件(乗車券)は色指定なし(デフォルトの枠線のまま)
    expect(badges[2].style.borderColor).toBe('');

    expect(document.getElementById('prereqResultModalBackdrop')!.classList.contains('open')).toBe(false);
  });

  it('未分類キーワードの外枠色はcookie(kw_pal_unc)でカスタマイズされていればそれを使う(AIチャットページの🔑分類モーダルと配色を共有)', async () => {
    document.cookie = 'kw_pal_unc=' + encodeURIComponent('#ff0000');
    await setupBadgeTest({ vectorized: true, keywordsRegistered: true });
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const btn = document.getElementById('answerModalKeywordListBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const badges = Array.from(document.querySelectorAll('.prereq-kw-badge')) as HTMLElement[];
    expect(badges[1].textContent).toBe('東京駅 (2)');
    expect(badges[1].style.borderColor).toBe('rgb(255, 0, 0)');

    document.cookie = 'kw_pal_unc=; max-age=0';
  });
});

// 対象: 「キーワード一覧」モーダルの「一括登録」ボタン。未登録キーワード
// (出現回数0件)を1件でも含む場合にモーダル最下段に表示され、押すと
// 「検索窓にキーワードを入力→📋ボタン→検索ログ:モーダルでの承認して登録」
// の一連の手続きを未登録キーワードすべてについて自動で行う。
//
// 故障シナリオ:
//   (1) 未登録キーワードが1件もない場合でもボタンが表示されてしまう
//   (2) ボタンを押しても検索(shares/search)→open-modal→approveの
//       3ステップが正しい順・正しい引数で呼ばれない
//   (3) 1件のキーワード処理が失敗すると残りのキーワードの登録が
//       止まってしまう(1件の失敗で全体を巻き込むべきではない)
//   (4) ループが進んでも中抜き強調表示(kw-badge-registering)が
//       現在処理中のバッジへ移動しない、または前のバッジに残ったままになる
describe('回答モーダル(DOM実動作): 「キーワード一覧」モーダルの「一括登録」ボタン', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  async function setupBulkRegisterTest() {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ({
      clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    });
    const shareResponse = {
      id: 's1', question: '質問文', answer: '回答文', model: 'model-a',
      created_at: '2026-08-02T09:30:00.000Z', access_count: 3, user_hash: 'hash123',
      input_tokens: 10, output_tokens: 20, vectorized: true, keywordsRegistered: true,
    };
    const calls: Array<{ kind: string; url: string; body: unknown }> = [];
    const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
      const u = String(url);
      const body = init && init.body ? JSON.parse(init.body) : null;
      if (u.includes('/api/aichat/answer-keywords')) {
        calls.push({ kind: 'answer-keywords', url: u, body });
        return Promise.resolve({ json: () => Promise.resolve({
          shareId: 's1', keywords: ['新幹線', '乗車券'],
          keywordOccurrences: [
            { keyword: '新幹線', count: 0, classified: false, categoryColor: null },
            { keyword: '乗車券', count: 0, classified: false, categoryColor: null },
          ],
        }) });
      }
      if (u.includes('/api/aichat/shares/search')) {
        calls.push({ kind: 'search', url: u, body });
        const q = decodeURIComponent(u.split('q=')[1] || '');
        if (q === '乗車券') return Promise.resolve({ json: () => Promise.resolve({ results: [] }) });
        return Promise.resolve({ json: () => Promise.resolve({ results: [{ id: 'sA' }, { id: 'sB' }] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        calls.push({ kind: 'open-modal', url: u, body });
        // sBだけ「既に登録済み(isNew:false)」、それ以外(sA・検索ヒットゼロ時に
        // 補完される起点shareIdのs1等)は未登録(isNew:true)として扱う
        const reqShareIds = (body as { shareIds?: string[] } | null)?.shareIds ?? [];
        const entries = reqShareIds.map((id) => ({ shareId: id, model: 'm', question: 'q', isNew: id !== 'sB' }));
        return Promise.resolve({ json: () => Promise.resolve({ entries }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        calls.push({ kind: 'approve', url: u, body });
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, count: 1 }) });
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

    return { calls };
  }

  async function openKeywordListModal() {
    openAnswerModalViaClick('s1');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const btn = document.getElementById('answerModalKeywordListBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  it('未登録キーワードが1件もない場合は「一括登録」ボタンを表示しない', async () => {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ({
      clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    });
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/answer-keywords')) {
        return Promise.resolve({ json: () => Promise.resolve({
          shareId: 's1', keywords: ['新幹線'],
          keywordOccurrences: [{ keyword: '新幹線', count: 3, classified: true, categoryColor: '#3b82f6' }],
        }) });
      }
      if (u.includes('share-keywords')) return Promise.resolve({ json: () => Promise.resolve({ keywords: [] }) });
      if (u.includes('/api/aichat/shares/')) return Promise.resolve({ json: () => Promise.resolve({ id: 's1', question: 'Q', answer: 'A', vectorized: true, keywordsRegistered: true }) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('alert', vi.fn());
    const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    await openKeywordListModal();

    expect((document.getElementById('prereqModalFoot') as HTMLElement).style.display).toBe('none');
  });

  it('未登録キーワードが1件でもあれば「一括登録」ボタンを表示する', async () => {
    await setupBulkRegisterTest();
    await openKeywordListModal();

    expect((document.getElementById('prereqModalFoot') as HTMLElement).style.display).not.toBe('none');
  });

  it('「一括登録」を押すと未登録キーワードごとに検索→open-modal→approveの順で呼ばれ、approveには未登録(isNew)のshareIdのみを渡す', async () => {
    const { calls } = await setupBulkRegisterTest();
    await openKeywordListModal();

    const btn = document.getElementById('prereqBulkRegisterBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    const shinkansenCalls = calls.filter((c) => c.body && (c.body as { keyword?: string }).keyword === '新幹線');
    expect(shinkansenCalls.map((c) => c.kind)).toEqual(['open-modal', 'approve']);
    const approveCall = shinkansenCalls.find((c) => c.kind === 'approve')!;
    // sA(検索ヒット・未登録)に加えて、起点shareId(s1)も検索結果に関わらず
    // 常に登録対象へ補完されるため両方approveされる(sBは登録済み扱いなので含まれない)
    expect(approveCall.body).toEqual({ keyword: '新幹線', shareIds: ['sA', 's1'] });

    // 根本原因の修正確認: テキスト検索でヒットする回答が無いキーワード(乗車券)
    // でも、抽出元の回答文(s1)は検索結果の有無に関わらず必ず登録対象へ
    // 補完されるため、open-modal/approveまで進んで s1 が登録される
    // (修正前はここで0件のまま何も登録されない不具合があった)。
    const norimonoCalls = calls.filter((c) => c.body && (c.body as { keyword?: string }).keyword === '乗車券');
    expect(norimonoCalls.map((c) => c.kind)).toEqual(['open-modal', 'approve']);
    const norimonoOpenModal = norimonoCalls.find((c) => c.kind === 'open-modal')!;
    expect(norimonoOpenModal.body).toEqual({ keyword: '乗車券', shareIds: ['s1'] });
    const norimonoApprove = norimonoCalls.find((c) => c.kind === 'approve')!;
    expect(norimonoApprove.body).toEqual({ keyword: '乗車券', shareIds: ['s1'] });

    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('登録完了');
  });

  it('処理中にボタンを連打しても二重にループが走らない(approveへ同じキーワードが複数回渡らない)', async () => {
    const { calls } = await setupBulkRegisterTest();
    await openKeywordListModal();

    const btn = document.getElementById('prereqBulkRegisterBtn') as HTMLButtonElement;
    // 実行中に同じボタンへ立て続けにclickイベントを送っても、
    // disabled化とrunBulkRegister内のガードにより二重実行されない
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    const shinkansenApproveCalls = calls.filter(
      (c) => c.kind === 'approve' && c.body && (c.body as { keyword?: string }).keyword === '新幹線'
    );
    expect(shinkansenApproveCalls).toHaveLength(1);
  });

  it('1件のキーワード登録に失敗しても残りのキーワードの処理を続ける', async () => {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ({
      clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    });
    const approveCalls: unknown[] = [];
    const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
      const u = String(url);
      const body = init && init.body ? JSON.parse(init.body) : null;
      if (u.includes('/api/aichat/answer-keywords')) {
        return Promise.resolve({ json: () => Promise.resolve({
          shareId: 's1', keywords: ['新幹線', '乗車券'],
          keywordOccurrences: [
            { keyword: '新幹線', count: 0, classified: false, categoryColor: null },
            { keyword: '乗車券', count: 0, classified: false, categoryColor: null },
          ],
        }) });
      }
      if (u.includes('/api/aichat/shares/search')) {
        if (u.includes('q=%E6%96%B0%E5%B9%B9%E7%B7%9A')) return Promise.reject(new Error('network error'));
        return Promise.resolve({ json: () => Promise.resolve({ results: [{ id: 'sA' }] }) });
      }
      if (u.includes('/api/aichat/search-log/open-modal')) {
        return Promise.resolve({ json: () => Promise.resolve({ entries: [{ shareId: 'sA', model: 'm', question: 'q', isNew: true }] }) });
      }
      if (u.includes('/api/aichat/search-log/approve')) {
        approveCalls.push(body);
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, count: 1 }) });
      }
      if (u.includes('share-keywords')) return Promise.resolve({ json: () => Promise.resolve({ keywords: [] }) });
      if (u.includes('/api/aichat/shares/')) return Promise.resolve({ json: () => Promise.resolve({ id: 's1', question: 'Q', answer: 'A', vectorized: true, keywordsRegistered: true }) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('alert', vi.fn());
    const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    await openKeywordListModal();
    const btn = document.getElementById('prereqBulkRegisterBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 30));

    // 新幹線の検索(shares/search)が失敗しても、乗車券のapproveは実行される
    expect(approveCalls).toEqual([{ keyword: '乗車券', shareIds: ['sA'] }]);
    expect(btn.textContent).toBe('登録完了');
  });

  it('ループが進むたびに現在処理中のバッジへkw-badge-registeringクラスが移動する(前のバッジからは外れる)', async () => {
    // 両方のキーワードの検索(shares/search)を明示的に制御されたPromiseで
    // 止め、各ステップの途中経過(どのバッジが強調表示されているか)を
    // 確実に観測できるようにする。
    let resolveFirstSearch: ((v: unknown) => void) | null = null;
    let resolveSecondSearch: ((v: unknown) => void) | null = null;
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ({
      clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    });
    const fetchMock = vi.fn((url: string) => {
      const u = String(url);
      if (u.includes('/api/aichat/answer-keywords')) {
        return Promise.resolve({ json: () => Promise.resolve({
          shareId: 's1', keywords: ['新幹線', '乗車券'],
          keywordOccurrences: [
            { keyword: '新幹線', count: 0, classified: false, categoryColor: null },
            { keyword: '乗車券', count: 0, classified: false, categoryColor: null },
          ],
        }) });
      }
      if (u.includes('/api/aichat/shares/search')) {
        if (u.includes('q=%E6%96%B0%E5%B9%B9%E7%B7%9A')) {
          return new Promise((resolve) => { resolveFirstSearch = resolve; })
            .then(() => ({ json: () => Promise.resolve({ results: [] }) }));
        }
        return new Promise((resolve) => { resolveSecondSearch = resolve; })
          .then(() => ({ json: () => Promise.resolve({ results: [] }) }));
      }
      if (u.includes('share-keywords')) return Promise.resolve({ json: () => Promise.resolve({ keywords: [] }) });
      if (u.includes('/api/aichat/shares/')) return Promise.resolve({ json: () => Promise.resolve({ id: 's1', question: 'Q', answer: 'A', vectorized: true, keywordsRegistered: true }) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('alert', vi.fn());
    const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    await openKeywordListModal();
    const badges = Array.from(document.querySelectorAll('.prereq-kw-badge')) as HTMLElement[];
    const btn = document.getElementById('prereqBulkRegisterBtn') as HTMLButtonElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 1件目(新幹線)を処理中: 1件目だけ強調表示されている
    expect(badges[0].classList.contains('kw-badge-registering')).toBe(true);
    expect(badges[1].classList.contains('kw-badge-registering')).toBe(false);

    resolveFirstSearch!(undefined);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 2件目(乗車券)に移動: 1件目からは外れ、2件目に付く
    expect(badges[0].classList.contains('kw-badge-registering')).toBe(false);
    expect(badges[1].classList.contains('kw-badge-registering')).toBe(true);

    resolveSecondSearch!(undefined);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(badges[1].classList.contains('kw-badge-registering')).toBe(false);
  });
});
