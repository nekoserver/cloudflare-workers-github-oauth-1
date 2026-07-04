import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { getHeritageAccessPage } from './views/heritageAccess';

// ---------------------------------------------------------------------------
// 振る舞いテスト（文字列マッチではなく実DOMで openAccordion を実行）
//
// 目的:
//   「都市名タップでアコーディオンが開いたとき、メニュー内のすべての世界遺産名に
//    対して既存キャッシュの質問判定（=トピックバッジ付与）が行われること」を保証する。
//   キーワードバッジ処理（checkHeritageKeywords）と競合して一部の遺産でバッジが
//   欠落しないことも併せて検証する。
//
// 手法:
//   getHeritageAccessPage() が返す HTML をそのまま jsdom に読み込み、
//   ページ内 <script> を window.eval で実行する。fetch はモックして
//   各エンドポイントの応答を制御し、openAccordion(tr) を直接呼んで
//   生成された DOM を検査する。
// ---------------------------------------------------------------------------

type FetchHandler = (url: string, opts?: any) => any;

function extractMainScript(html: string): string {
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  let best = '';
  while ((m = re.exec(html)) !== null) {
    if (m[1].indexOf('function openAccordion(') !== -1) {
      best = m[1];
      break;
    }
  }
  if (!best) throw new Error('openAccordion を含む <script> が見つかりません');
  return best;
}

// 連続する非同期 fetch チェーン（city-all-heritages → keywords-check →
// search-keywords-check → batch）を確実に消化するためのフラッシュ。
async function flush(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

interface Harness {
  window: any;
  document: any;
  openCity: (cc?: string) => any; // 都市行を作って openAccordion を呼び、accordion-inner を返す
}

function setupHarness(handler: FetchHandler): Harness {
  const html = getHeritageAccessPage('testuser');
  const script = extractMainScript(html);
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/' });
  const window: any = dom.window;

  // fetch をモック（script 実行前に注入）。Response 風オブジェクトを返す。
  window.fetch = (url: string, opts?: any) => {
    const body = handler(String(url), opts);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body === undefined ? {} : body),
    });
  };

  // ページスクリプトを実行（全関数が window スコープに定義される）。
  window.eval(script);

  function openCity(cc = 'FR') {
    const document = window.document;
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    tr.setAttribute('data-city', 'TestCity');
    tr.setAttribute('data-lat', '48.85');
    tr.setAttribute('data-lon', '2.35');
    tr.setAttribute('data-cc', cc);
    tr.innerHTML = '<td>1</td><td>2</td><td>3</td>';
    tbody.appendChild(tr);
    table.appendChild(tbody);
    document.body.appendChild(table);
    window.openAccordion(tr);
    return tr;
  }

  return { window, document: window.document, openCity };
}

// あるアコーディオン内の特定遺産名に付与されたトピックバッジ文字列一覧を取得する。
function topicBadgesFor(inner: any, heritage: string): string[] {
  const out: string[] = [];
  const wraps = inner.querySelectorAll('.acc-name-wrap');
  wraps.forEach((wrap: any) => {
    const link = wrap.querySelector('.acc-name-link[data-heritage]');
    if (!link || link.getAttribute('data-heritage') !== heritage) return;
    wrap.querySelectorAll('.acc-topic-badge').forEach((b: any) => out.push(b.textContent));
  });
  return out;
}

function kwBadgePresentFor(inner: any, heritage: string): boolean {
  let found = false;
  inner.querySelectorAll('.acc-name-wrap').forEach((wrap: any) => {
    const link = wrap.querySelector('.acc-name-link[data-heritage]');
    if (!link || link.getAttribute('data-heritage') !== heritage) return;
    if (wrap.querySelector('.acc-kw-badge')) found = true;
  });
  return found;
}

function defaultHandler(overrides: Record<string, any>): FetchHandler {
  return (url: string) => {
    if (url.indexOf('/api/heritage-access-ranking') !== -1) return { rows: [] };
    if (url.indexOf('/api/city-all-heritages') !== -1) return overrides.cityHeritages;
    if (url.indexOf('/api/aichat/heritage-keywords-check') !== -1) return overrides.keywordsCheck ?? { hits: {} };
    if (url.indexOf('/api/aichat/heritage-search-keywords-check') !== -1) return overrides.searchKeywords ?? { keywordCounts: {} };
    if (url.indexOf('/api/aichat/check-heritage-questions-batch') !== -1) return overrides.batch ?? { answered: {} };
    if (url.indexOf('/api/aichat/check-heritage-questions') !== -1) return overrides.single ?? { answered: {} };
    return {};
  };
}

const THREE_HERITAGES = {
  heritages: [
    { heritage_name: 'H1', distance_km: 10, country_flag: '🇫🇷' },
    { heritage_name: 'H2', distance_km: 20, country_flag: '🇫🇷' },
    { heritage_name: 'H3', distance_km: 30, country_flag: '🇫🇷' },
  ],
};

describe('アコーディオン: 都市タップ時に全世界遺産へキャッシュ質問判定（トピックバッジ）が行われる', () => {
  it('キャッシュ済みの全遺産（H1/H2/H3）にトピックバッジが付与される', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: THREE_HERITAGES,
        // キーワード処理は H1 のみヒット（DOM 変換が起きる遺産と起きない遺産を混在させる）
        keywordsCheck: { hits: { H1: ['見どころ'] } },
        searchKeywords: { keywordCounts: { H2: 1 } },
        // バッチ（ai_chat_shares 由来）では3遺産すべてに交通手段のキャッシュあり
        batch: { answered: { H1: { 交通手段: 's1' }, H2: { 交通手段: 's2' }, H3: { 交通手段: 's3' } } },
      })
    );
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    expect(inner).toBeTruthy();

    // 肝心の検証: 3遺産すべてに「交通手段」バッジが付与されていること
    expect(topicBadgesFor(inner, 'H1')).toContain('交通手段');
    expect(topicBadgesFor(inner, 'H2')).toContain('交通手段');
    expect(topicBadgesFor(inner, 'H3')).toContain('交通手段');
  });

  it('キーワードヒットが一切なくてもキャッシュ済み全遺産にトピックバッジが付く', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: THREE_HERITAGES,
        keywordsCheck: { hits: {} },
        searchKeywords: { keywordCounts: {} },
        batch: { answered: { H1: { 見どころ: 'a' }, H2: { 見どころ: 'b' }, H3: { 見どころ: 'c' } } },
      })
    );
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    expect(topicBadgesFor(inner, 'H1')).toContain('見どころ');
    expect(topicBadgesFor(inner, 'H2')).toContain('見どころ');
    expect(topicBadgesFor(inner, 'H3')).toContain('見どころ');
  });

  it('キーワードバッジとトピックバッジが競合せず共存する（H1 にキーワードバッジ＋キャッシュバッジ両方）', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: THREE_HERITAGES,
        keywordsCheck: { hits: {} },
        // H1 にキーワードバッジを付与
        searchKeywords: { keywordCounts: { H1: 1 } },
        // 同じ H1 にキャッシュ質問バッジ（交通手段）も付与
        batch: { answered: { H1: { 交通手段: 's1' }, H2: { 交通手段: 's2' } } },
      })
    );
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    // キーワードバッジが H1 に残っている（トピックバッジ追加で消えない）
    expect(kwBadgePresentFor(inner, 'H1')).toBe(true);
    // かつ交通手段のキャッシュバッジも付いている
    expect(topicBadgesFor(inner, 'H1')).toContain('交通手段');
    // H2 にもキャッシュバッジ
    expect(topicBadgesFor(inner, 'H2')).toContain('交通手段');
  });

  it('複数トピックがキャッシュ済みの場合、全トピックがバッジ化され重複しない', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: 'H1', distance_km: 10, country_flag: '' }] },
        keywordsCheck: { hits: { H1: ['見どころ'] } },
        searchKeywords: { keywordCounts: {} },
        batch: { answered: { H1: { 見どころ: 'x', 交通手段: 'y', 宿泊施設: 'z' } } },
      })
    );
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    const badges = topicBadgesFor(inner, 'H1');
    expect(badges).toContain('見どころ');
    expect(badges).toContain('交通手段');
    expect(badges).toContain('宿泊施設');
    // 見どころはキーワード由来とキャッシュ由来で二重付与されない
    expect(badges.filter((b) => b === '見どころ').length).toBe(1);
  });
});

describe('アコーディオン: メモリキャッシュ（cityCache）', () => {
  it('2回目の同一都市オープンでは city-all-heritages を呼ばない', async () => {
    let heritageCallCount = 0;
    const handler = (url: string) => {
      if (url.indexOf('/api/heritage-access-ranking') !== -1) return { rows: [] };
      if (url.indexOf('/api/city-all-heritages') !== -1) { heritageCallCount++; return THREE_HERITAGES; }
      if (url.indexOf('/api/aichat/heritage-keywords-check') !== -1) return { hits: {} };
      if (url.indexOf('/api/aichat/heritage-search-keywords-check') !== -1) return { keywordCounts: {} };
      if (url.indexOf('/api/aichat/check-heritage-questions-batch') !== -1) return { answered: { H1: { '交通手段': 's1' } } };
      return {};
    };
    const h = setupHarness(handler);

    const tr1 = h.openCity();
    await flush();
    expect(heritageCallCount).toBe(1);
    const inner1 = tr1.nextSibling && (tr1.nextSibling as any).querySelector('.accordion-inner');
    expect(topicBadgesFor(inner1, 'H1')).toContain('交通手段');

    // アコーディオンを閉じる
    const accRow = tr1.nextSibling as any;
    if (accRow) accRow.parentNode.removeChild(accRow);
    tr1.classList.remove('row-open');

    // 2回目オープン（キャッシュヒット）
    const tr2 = h.openCity();
    await flush();
    expect(heritageCallCount).toBe(1); // 再フェッチなし
    const inner2 = tr2.nextSibling && (tr2.nextSibling as any).querySelector('.accordion-inner');
    expect(topicBadgesFor(inner2, 'H1')).toContain('交通手段');
  });

  it('キャッシュヒット時も answered の更新バッチは呼ばれる', async () => {
    let batchCallCount = 0;
    const handler = (url: string) => {
      if (url.indexOf('/api/heritage-access-ranking') !== -1) return { rows: [] };
      if (url.indexOf('/api/city-all-heritages') !== -1) return THREE_HERITAGES;
      if (url.indexOf('/api/aichat/heritage-keywords-check') !== -1) return { hits: {} };
      if (url.indexOf('/api/aichat/heritage-search-keywords-check') !== -1) return { keywordCounts: {} };
      if (url.indexOf('/api/aichat/check-heritage-questions-batch') !== -1) { batchCallCount++; return { answered: {} }; }
      return {};
    };
    const h = setupHarness(handler);

    const tr1 = h.openCity();
    await flush();
    const acc1 = tr1.nextSibling as any;
    if (acc1) acc1.parentNode.removeChild(acc1);
    tr1.classList.remove('row-open');

    const tr2 = h.openCity();
    await flush();
    // キャッシュミス時1回 + キャッシュヒット時バックグラウンド1回 = 計2回
    expect(batchCallCount).toBe(2);
  });
});

describe('アコーディオン: 表示行数（API側のLIMIT 100に委ねる、フロント側で追加制限しない）', () => {
  function manyHeritages(count: number) {
    return {
      heritages: Array.from({ length: count }, (_, i) => ({
        heritage_name: 'H' + (i + 1),
        distance_km: (i + 1) * 10,
        country_flag: '🇫🇷',
      })),
    };
  }

  it('2000km以内に30件あれば、30行すべて表示される（20件などに切り詰めない）', async () => {
    const h = setupHarness(defaultHandler({ cityHeritages: manyHeritages(30) }));
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    expect(inner).toBeTruthy();
    expect(inner.querySelectorAll('.acc-row').length).toBe(30);
  });

  it('API上限の100件あれば、100行すべて表示される', async () => {
    const h = setupHarness(defaultHandler({ cityHeritages: manyHeritages(100) }));
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    expect(inner.querySelectorAll('.acc-row').length).toBe(100);
  });

  it('該当件数が少ない場合はその件数のまま表示される', async () => {
    const h = setupHarness(defaultHandler({ cityHeritages: THREE_HERITAGES }));
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    expect(inner.querySelectorAll('.acc-row').length).toBe(3);
  });
});
