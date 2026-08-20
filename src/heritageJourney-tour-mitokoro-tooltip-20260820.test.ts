// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { getHeritageJourneyPage } from './views/heritageJourney';
import { HERITAGE_LIST } from './data/heritageList';

const HERITAGE_NAMES = new Set(HERITAGE_LIST.map((h) => h.n));

/** ルート順序表示板の行のうち、出発/到着都市ではなく実際の世界遺産である最初の行を探す。 */
function findHeritageRow(): HTMLElement {
  const rows = Array.from(document.querySelectorAll('#tour-route-side-list [data-side-name]')) as HTMLElement[];
  const row = rows.find((r) => HERITAGE_NAMES.has(r.getAttribute('data-side-name') || ''));
  if (!row) throw new Error('世界遺産の経由地が巡回ルートに1件も含まれていない(テストの前提が崩れている)');
  return row;
}

// 対象: /heritage-journeyページの「🌐 巡回テスト」モーダルの地球儀タップ
// ツールチップ(#tour-tap-label)。地点名タップ時に、その世界遺産に
// 「見どころ」AI回答キャッシュ(src/utils/heritageMitokoroModal.tsで共通化した
// fetchHeritageMitokoroShareIds / openHeritageMitokoroModal)が存在すれば
// アイコン(#tour-tap-mitokoro-btn)をツールチップ内に表示し、タップすると
// getNextZ()相当のレイヤーでモーダルを開いて見どころ本文を表示する。
// 存在しない場合はアイコンを一切表示しない。
//
// 故障シナリオ:
//   (1) 見どころ回答が存在するのにアイコンが出ない
//   (2) 見どころ回答が存在しないのにアイコンが出てしまう
//   (3) アイコンをタップしてもモーダルが開かない、または本文が表示されない
//   (4) モーダルの✕ボタンで閉じられない

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) });
}

/**
 * バッチ確認APIのリクエストボディに含まれる地点名すべてを「gemmaキャッシュ済み
 * (shareId='share-abc')」として返すfetchモックを組み立てる。巡回テストの
 * 実際の経由地選択(検索・迂回距離しきい値等)に依存せず、どの地点がルート
 * 順序表示板の行になっても必ず見どころアイコンが出る状態を作れる。
 */
function buildFetchMock(opts: { answerText?: string; hitCount?: number; keywords?: string[] } = {}) {
  const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
    const u = String(url);
    if (u.includes('check-heritage-mitokoro-gemma-batch')) {
      const body = init && init.body ? JSON.parse(init.body) : { heritages: [] };
      const names: string[] = body.heritages || [];
      const map: Record<string, string> = {};
      names.forEach((n) => { map[n] = 'share-abc'; });
      return jsonResponse({ cached: map });
    }
    if (u.includes('check-heritage-mitokoro-llama-batch')) {
      return jsonResponse({ cached: {} });
    }
    if (u.includes('/api/aichat/shares/share-abc')) {
      return jsonResponse({ answer: opts.answerText ?? '## 見どころ\nテスト説明文です。' });
    }
    if (u.includes('heritage-mitokoro-keyword-hits')) {
      return jsonResponse({ hitCount: opts.hitCount ?? 0, keywords: opts.keywords ?? [] });
    }
    return jsonResponse({});
  });
  return { fetchMock };
}

function setupPage(fetchImpl: (url: string, init?: unknown) => Promise<unknown>) {
  const html = getHeritageJourneyPage();
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('<script>'));
  const scriptSrc = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const ctx: Record<string, unknown> = {
    clearRect: () => {}, beginPath: () => {}, ellipse: () => {}, arc: () => {},
    fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {}, fillText: () => {},
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '',
  };
  const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
  proto.getContext = () => ctx;
  (globalThis as unknown as { fetch: unknown }).fetch = fetchImpl;
  // eslint-disable-next-line no-new-func
  new Function(scriptSrc)();
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('heritage-journeyページ: タップツールチップの見どころアイコン', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
  });

  it('見どころ回答キャッシュが存在する地点をタップすると、ツールチップ内にアイコンが表示される', async () => {
    const { fetchMock } = buildFetchMock();
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    const name = row.getAttribute('data-side-name');

    row.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(name + ' 👀');
    const icon = document.getElementById('tour-tap-mitokoro-btn');
    expect(icon).not.toBeNull();
    expect(icon!.textContent).toBe('👀');
  });

  it('見どころ回答キャッシュが存在しない地点をタップしてもアイコンは表示されない', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ cached: {} }));
    setupPage(fetchMock);
    await flushMicrotasks();

    const firstRow = document.querySelector('#tour-route-side-list [data-side-name]') as HTMLElement;
    firstRow.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(firstRow.getAttribute('data-side-name'));
    expect(document.getElementById('tour-tap-mitokoro-btn')).toBeNull();
  });

  it('アイコンをタップすると見どころモーダルが開き、取得した回答本文が表示される', async () => {
    const { fetchMock } = buildFetchMock({ answerText: '## 見どころ本文\nテスト説明文です。' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    row.click();

    const icon = document.getElementById('tour-tap-mitokoro-btn')!;
    icon.click();

    await flushMicrotasks();

    const overlay = document.querySelector('[data-overlay]');
    expect(overlay).not.toBeNull();
    const body = overlay!.querySelector('.mitokoro-md');
    expect(body).not.toBeNull();
    expect(body!.innerHTML).toContain('見どころ本文');
    expect(body!.innerHTML).toContain('テスト説明文です');
  });

  it('見どころモーダルは✕ボタンで閉じられる', async () => {
    const { fetchMock } = buildFetchMock();
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    row.click();
    const icon = document.getElementById('tour-tap-mitokoro-btn')!;
    icon.click();
    await flushMicrotasks();

    expect(document.querySelectorAll('[data-overlay]').length).toBe(1);
    const closeBtn = document.querySelector('[data-overlay] button[aria-label="閉じる"]') as HTMLElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(document.querySelectorAll('[data-overlay]').length).toBe(0);
  });
});
