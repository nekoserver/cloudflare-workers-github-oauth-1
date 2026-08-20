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
// アイコンをツールチップ内に表示し、タップするとgetNextZ()相当のレイヤーで
// モーダルを開いて見どころ本文を表示する。
//
// 本来の実装元である src/views/webglHeritage.ts (3D地球儀ページ) の
// ツールチップでは、gemma回答(👀)とllama回答(👁️)は互いに排他ではなく、
// 同じ世界遺産に両方のキャッシュが存在する場合は両方のアイコンが独立して
// 表示され、それぞれ別のモーダル(別のshareId・別のモデル名)を開く。
// 「過去ログ」的な複数件の履歴一覧は存在せず、各アイコンは常にその
// モデル1件分の最新キャッシュ回答を表示するだけ(単一回答モーダル)。
// このテストは、その実装をheritage-journeyページのタップツールチップへ
// 忠実に移植できていることを検証する。
//
// 故障シナリオ:
//   (1) gemma回答のみ存在する場合に👀だけが出て👁️は出ない
//   (2) llama回答のみ存在する場合に👁️だけが出て👀は出ない
//   (3) 両方存在する場合に👀・👁️の両方が同時に(片方が握りつぶされずに)出る
//   (4) どちらも存在しない場合はアイコンが一切出ない
//   (5) 👀タップでgemmaのshareId・👁️タップでllamaのshareIdを使ってモーダルが開く
//       (取り違えていないか)
//   (6) モーダルの✕ボタンで閉じられる

function jsonResponse(body: unknown) {
  return Promise.resolve({ json: () => Promise.resolve(body) });
}

/**
 * gemma/llamaバッチ確認APIのレスポンスをそれぞれ指定して組み立てる
 * fetchモック。/api/aichat/shares/{shareId}はshareIdごとに異なる本文を
 * 返せるようにし、アイコンとshareIdの取り違えを検出できるようにする。
 */
function buildFetchMock(opts: {
  gemmaShareId?: string | null;
  llamaShareId?: string | null;
  answers?: Record<string, string>;
} = {}) {
  const answers = opts.answers ?? {
    'share-gemma': '## gemmaの見どころ\ngemma回答本文です。',
    'share-llama': '## llamaの見どころ\nllama回答本文です。',
  };
  const fetchMock = vi.fn((url: string, init?: { body?: string }) => {
    const u = String(url);
    if (u.includes('check-heritage-mitokoro-gemma-batch')) {
      const body = init && init.body ? JSON.parse(init.body) : { heritages: [] };
      const names: string[] = body.heritages || [];
      const map: Record<string, string> = {};
      if (opts.gemmaShareId) names.forEach((n) => { map[n] = opts.gemmaShareId as string; });
      return jsonResponse({ cached: map });
    }
    if (u.includes('check-heritage-mitokoro-llama-batch')) {
      const body = init && init.body ? JSON.parse(init.body) : { heritages: [] };
      const names: string[] = body.heritages || [];
      const map: Record<string, string> = {};
      if (opts.llamaShareId) names.forEach((n) => { map[n] = opts.llamaShareId as string; });
      return jsonResponse({ cached: map });
    }
    const sharesMatch = u.match(/\/api\/aichat\/shares\/([^/?]+)/);
    if (sharesMatch) {
      const shareId = decodeURIComponent(sharesMatch[1]);
      return jsonResponse({ answer: answers[shareId] ?? ('本文(' + shareId + ')') });
    }
    if (u.includes('heritage-mitokoro-keyword-hits')) {
      return jsonResponse({ hitCount: 0, keywords: [] });
    }
    return jsonResponse({});
  });
  return { fetchMock };
}

function setupPage(fetchImpl: (url: string, init?: { body?: string }) => Promise<unknown>) {
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

describe('heritage-journeyページ: タップツールチップの見どころアイコン(gemma👀/llama👁️)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    (globalThis as unknown as { fetch: unknown }).fetch = originalFetch;
  });

  it('ラベル全体が地球儀の操作を妨げないまま、見どころアイコンだけはタップ操作を受け付ける', () => {
    const html = getHeritageJourneyPage();
    expect(html).toMatch(/\.tour-tap-label\{[^}]*pointer-events:none/);
    expect(html).toMatch(/#tour-tap-mitokoro-gemma-btn,#tour-tap-mitokoro-llama-btn\{[^}]*pointer-events:auto[^}]*touch-action:manipulation/);
  });

  it('gemma回答のみキャッシュされている場合、👀だけが表示され👁️は表示されない', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    const name = row.getAttribute('data-side-name');
    row.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(name + ' 👀');
    expect(document.getElementById('tour-tap-mitokoro-gemma-btn')).not.toBeNull();
    expect(document.getElementById('tour-tap-mitokoro-llama-btn')).toBeNull();
  });

  it('llama回答のみキャッシュされている場合、👁️だけが表示され👀は表示されない', async () => {
    const { fetchMock } = buildFetchMock({ llamaShareId: 'share-llama' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    const name = row.getAttribute('data-side-name');
    row.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(name + ' 👁️');
    expect(document.getElementById('tour-tap-mitokoro-gemma-btn')).toBeNull();
    expect(document.getElementById('tour-tap-mitokoro-llama-btn')).not.toBeNull();
  });

  it('gemma・llama両方のキャッシュが存在する場合、👀と👁️の両方が同時に表示される(片方が握りつぶされない)', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma', llamaShareId: 'share-llama' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    const name = row.getAttribute('data-side-name');
    row.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(name + ' 👀 👁️');
    expect(document.getElementById('tour-tap-mitokoro-gemma-btn')).not.toBeNull();
    expect(document.getElementById('tour-tap-mitokoro-llama-btn')).not.toBeNull();
  });

  it('どちらの回答もキャッシュされていない場合、アイコンは一切表示されない', async () => {
    const { fetchMock } = buildFetchMock({});
    setupPage(fetchMock);
    await flushMicrotasks();

    const firstRow = document.querySelector('#tour-route-side-list [data-side-name]') as HTMLElement;
    firstRow.click();

    const tapLabel = document.getElementById('tour-tap-label')!;
    expect(tapLabel.textContent).toBe(firstRow.getAttribute('data-side-name'));
    expect(document.getElementById('tour-tap-mitokoro-gemma-btn')).toBeNull();
    expect(document.getElementById('tour-tap-mitokoro-llama-btn')).toBeNull();
  });

  it('👀をタップするとgemmaのshareIdで見どころモーダルが開き、本文が表示される', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma', llamaShareId: 'share-llama' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    row.click();

    const gemmaBtn = document.getElementById('tour-tap-mitokoro-gemma-btn')!;
    gemmaBtn.click();
    await flushMicrotasks();

    const overlay = document.querySelector('[data-overlay]');
    expect(overlay).not.toBeNull();
    const body = overlay!.querySelector('.mitokoro-md');
    expect(body).not.toBeNull();
    expect(body!.innerHTML).toContain('gemmaの見どころ');
    expect(body!.innerHTML).toContain('gemma回答本文です');
    expect(body!.innerHTML).not.toContain('llama回答本文です');
  });

  it('👁️をタップするとllamaのshareIdで見どころモーダルが開き、本文が表示される(gemmaと取り違えない)', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma', llamaShareId: 'share-llama' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    row.click();

    const llamaBtn = document.getElementById('tour-tap-mitokoro-llama-btn')!;
    llamaBtn.click();
    await flushMicrotasks();

    const overlay = document.querySelector('[data-overlay]');
    expect(overlay).not.toBeNull();
    const body = overlay!.querySelector('.mitokoro-md');
    expect(body).not.toBeNull();
    expect(body!.innerHTML).toContain('llamaの見どころ');
    expect(body!.innerHTML).toContain('llama回答本文です');
    expect(body!.innerHTML).not.toContain('gemma回答本文です');
  });

  it('見どころモーダルは✕ボタンで閉じられる', async () => {
    const { fetchMock } = buildFetchMock({ gemmaShareId: 'share-gemma' });
    setupPage(fetchMock);
    await flushMicrotasks();

    const row = findHeritageRow();
    row.click();
    const gemmaBtn = document.getElementById('tour-tap-mitokoro-gemma-btn')!;
    gemmaBtn.click();
    await flushMicrotasks();

    expect(document.querySelectorAll('[data-overlay]').length).toBe(1);
    const closeBtn = document.querySelector('[data-overlay] button[aria-label="閉じる"]') as HTMLElement;
    expect(closeBtn).not.toBeNull();
    closeBtn.click();
    expect(document.querySelectorAll('[data-overlay]').length).toBe(0);
  });
});
