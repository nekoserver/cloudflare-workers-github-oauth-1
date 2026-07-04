import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getHeritageAccessPage } from './views/heritageAccess';

// ---------------------------------------------------------------------------
// 世界遺産アクセスランキングページに追加した「AIチャット履歴検索サイドバー」の
// 振る舞いテスト。文字列マッチではなく実DOM(jsdom)でページのスクリプトを実行し、
// トグルボタン・検索窓・結果一覧・クリア(×)ボタン・世界遺産名リンクからの
// 検索窓埋め込みを検証する。
// ---------------------------------------------------------------------------

type FetchHandler = (url: string, opts?: unknown) => unknown;

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

async function flush(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

// input debounce (350ms) を実際に待つ。
async function waitDebounce(): Promise<void> {
  await new Promise((r) => setTimeout(r, 420));
  await flush();
}

interface Harness {
  window: any;
  document: any;
  fetchCalls: string[];
  openCity: (cc?: string) => any;
}

function setupHarness(handler: FetchHandler): Harness {
  const html = getHeritageAccessPage('testuser');
  const script = extractMainScript(html);
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/' });
  const window: any = dom.window;
  const fetchCalls: string[] = [];

  window.fetch = (url: string, opts?: unknown) => {
    fetchCalls.push(String(url));
    const body = handler(String(url), opts);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body === undefined ? {} : body),
    });
  };

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

  return { window, document: window.document, fetchCalls, openCity };
}

function defaultHandler(overrides: Record<string, any>): FetchHandler {
  return (url: string) => {
    if (url.indexOf('/api/heritage-access-ranking') !== -1) return { rows: [] };
    if (url.indexOf('/api/city-all-heritages') !== -1) return overrides.cityHeritages;
    if (url.indexOf('/api/aichat/heritage-keywords-check') !== -1) return overrides.keywordsCheck ?? { hits: {} };
    if (url.indexOf('/api/aichat/heritage-search-keywords-check') !== -1) return overrides.searchKeywords ?? { keywordCounts: {} };
    if (url.indexOf('/api/aichat/check-heritage-questions-batch') !== -1) return overrides.batch ?? { answered: {} };
    if (url.indexOf('/api/aichat/check-heritage-questions') !== -1) return overrides.single ?? { answered: {} };
    if (url.indexOf('/api/aichat/shares/search') !== -1) return overrides.search ?? { results: [] };
    return {};
  };
}

describe('世界遺産アクセスランキング: サマリー行のサイドパネルトグルアイコン', () => {
  it('トグルボタンとサイドバー要素一式が存在する', () => {
    const h = setupHarness(defaultHandler({}));
    expect(h.document.getElementById('hist-side-toggle')).toBeTruthy();
    expect(h.document.getElementById('hist-side')).toBeTruthy();
    expect(h.document.getElementById('hist-side-search')).toBeTruthy();
    expect(h.document.getElementById('hist-side-clear')).toBeTruthy();
    expect(h.document.getElementById('hist-side-results')).toBeTruthy();
  });

  it('トグルボタンをタップするとサイドバーが開閉する', () => {
    const h = setupHarness(defaultHandler({}));
    const toggle = h.document.getElementById('hist-side-toggle');
    const side = h.document.getElementById('hist-side');
    expect(side.classList.contains('open')).toBe(false);
    toggle.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    expect(side.classList.contains('open')).toBe(true);
    expect(toggle.classList.contains('active')).toBe(true);
    toggle.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    expect(side.classList.contains('open')).toBe(false);
    expect(toggle.classList.contains('active')).toBe(false);
  });

  it('開くたびに getNextZ() 由来の z-index を設定する（固定値を書かない: CLAUDE.mdルール26）', () => {
    const h = setupHarness(defaultHandler({}));
    const toggle = h.document.getElementById('hist-side-toggle');
    const side = h.document.getElementById('hist-side');
    toggle.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    const z = parseInt(side.style.zIndex, 10);
    expect(Number.isNaN(z)).toBe(false);
    expect(z).toBeGreaterThanOrEqual(100);
  });
});

describe('世界遺産アクセスランキング: サイドバー内検索窓', () => {
  it('キー入力から一定時間後に /api/aichat/shares/search を呼び、結果を並べる', async () => {
    const h = setupHarness(
      defaultHandler({
        search: {
          results: [
            { id: 's1', question: '「タージ・マハル」の「見どころ」について説明してください', answer: '白亜の霊廟です。', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', created_at: '2026-01-01T10:00:00.000Z', access_count: 1 },
            { id: 's2', question: '「万里の長城」の「交通手段」について説明してください', answer: 'バスで行けます。', model: '@cf/google/gemma-4-26b-a4b-it', created_at: '2026-01-02T11:00:00.000Z', access_count: 2 },
          ],
        },
      })
    );
    const search = h.document.getElementById('hist-side-search');
    search.value = 'タージ・マハル';
    search.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    await waitDebounce();

    expect(h.fetchCalls.some((u) => u.indexOf('/api/aichat/shares/search?q=') !== -1)).toBe(true);
    const items = h.document.querySelectorAll('.hist-side-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.hist-side-q').textContent).toContain('タージ・マハル');
    const status = h.document.getElementById('hist-side-status');
    expect(status.textContent).toContain('2');
  });

  it('検索窓の入力をクリア(空)にすると結果とステータスがリセットされる', async () => {
    const h = setupHarness(
      defaultHandler({ search: { results: [{ id: 's1', question: 'Q', answer: 'A', model: 'm', created_at: '2026-01-01T00:00:00.000Z', access_count: 0 }] } })
    );
    const search = h.document.getElementById('hist-side-search');
    search.value = 'Q';
    search.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    await waitDebounce();
    expect(h.document.querySelectorAll('.hist-side-item').length).toBe(1);

    search.value = '';
    search.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    expect(h.document.getElementById('hist-side-results').innerHTML).toBe('');
    expect(h.document.getElementById('hist-side-status').textContent).toBe('');
  });

  it('検索結果の質問をタップするとAIチャットの詳細プレビューモーダルへ質問・回答が表示される', async () => {
    const h = setupHarness(
      defaultHandler({
        search: { results: [{ id: 's1', question: '「タージ・マハル」の「見どころ」について説明してください', answer: '白亜の霊廟です。', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', created_at: '2026-01-01T12:34:00.000Z', access_count: 7 }] },
      })
    );
    const search = h.document.getElementById('hist-side-search');
    search.value = 'タージ';
    search.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    await waitDebounce();

    const item = h.document.querySelector('.hist-side-item');
    item.dispatchEvent(new h.window.Event('click', { bubbles: true }));

    const modalOverlay = h.document.getElementById('hist-detail-overlay');
    expect(modalOverlay.classList.contains('open')).toBe(true);
    expect(h.document.getElementById('hist-detail-title').textContent).toBe('AIチャットの詳細プレビュー');
    const bubbles = h.document.querySelectorAll('.hist-detail-bubble');
    expect(bubbles[0].textContent).toContain('タージ・マハル');
    expect(bubbles[1].textContent).toBe('白亜の霊廟です。');
    expect(h.document.getElementById('hist-detail-model').textContent).toBe('llama-3.3-70b-instruct-fp8-fast');
    expect(h.document.getElementById('hist-detail-meta').textContent).toContain('7');
  });

  it('詳細プレビューモーダルは既存のAI回答モーダル(ai-modal-overlay)を開かない', async () => {
    const h = setupHarness(
      defaultHandler({
        search: { results: [{ id: 's1', question: 'Q', answer: 'A', model: 'm', created_at: '2026-01-01T00:00:00.000Z', access_count: 0 }] },
      })
    );
    const search = h.document.getElementById('hist-side-search');
    search.value = 'Q';
    search.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    await waitDebounce();

    h.document.querySelector('.hist-side-item').dispatchEvent(new h.window.Event('click', { bubbles: true }));

    expect(h.document.getElementById('ai-modal-overlay').classList.contains('open')).toBe(false);
  });

  it('×ボタンで詳細プレビューモーダルを閉じられる', async () => {
    const h = setupHarness(
      defaultHandler({
        search: { results: [{ id: 's1', question: 'Q', answer: 'A', model: 'm', created_at: '2026-01-01T00:00:00.000Z', access_count: 0 }] },
      })
    );
    const search = h.document.getElementById('hist-side-search');
    search.value = 'Q';
    search.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    await waitDebounce();
    h.document.querySelector('.hist-side-item').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    expect(h.document.getElementById('hist-detail-overlay').classList.contains('open')).toBe(true);

    h.document.getElementById('hist-detail-close').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    expect(h.document.getElementById('hist-detail-overlay').classList.contains('open')).toBe(false);
  });

  it('×ボタンをタップすると検索キーワード・結果・ステータスがリセットされる', async () => {
    const h = setupHarness(
      defaultHandler({ search: { results: [{ id: 's1', question: 'Q', answer: 'A', model: 'm', created_at: '2026-01-01T00:00:00.000Z', access_count: 0 }] } })
    );
    const search = h.document.getElementById('hist-side-search');
    const clearBtn = h.document.getElementById('hist-side-clear');
    search.value = 'Q';
    search.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    await waitDebounce();
    expect(clearBtn.classList.contains('visible')).toBe(true);

    clearBtn.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    expect(search.value).toBe('');
    expect(clearBtn.classList.contains('visible')).toBe(false);
    expect(h.document.getElementById('hist-side-results').innerHTML).toBe('');
    expect(h.document.getElementById('hist-side-status').textContent).toBe('');
  });
});

describe('世界遺産アクセスランキング: 世界遺産名リンクからサイドバー検索窓への埋め込み', () => {
  it('世界遺産名リンク(トピックキャッシュ由来)をタップするとサイドバーが開きその世界遺産名で検索される', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: 'タージ・マハル', distance_km: 10, country_flag: '🇮🇳' }] },
        keywordsCheck: { hits: { 'タージ・マハル': ['見どころ'] } },
        search: { results: [{ id: 's1', question: '「タージ・マハル」の「見どころ」について説明してください', answer: '回答', model: 'm', created_at: '2026-01-01T00:00:00.000Z', access_count: 0 }] },
      })
    );
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    const nameLink = inner.querySelector('.acc-name-link[data-heritage="タージ・マハル"]');
    expect(nameLink).toBeTruthy();

    nameLink.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    const side = h.document.getElementById('hist-side');
    expect(side.classList.contains('open')).toBe(true);
    expect(h.document.getElementById('hist-side-search').value).toBe('タージ・マハル');
    expect(h.fetchCalls.some((u) => u.indexOf('/api/aichat/shares/search?q=') !== -1 && u.indexOf(encodeURIComponent('タージ・マハル')) !== -1)).toBe(true);
  });

  it('世界遺産名リンク(キーワードバッジ由来のフォールバック)をタップしてもサイドバーへ埋め込まれる', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: '万里の長城', distance_km: 10, country_flag: '🇨🇳' }] },
        keywordsCheck: { hits: {} },
        searchKeywords: { keywordCounts: { '万里の長城': 1 } },
        search: { results: [] },
      })
    );
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    const nameLink = inner.querySelector('.acc-name-link[data-heritage="万里の長城"]');
    expect(nameLink).toBeTruthy();

    nameLink.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    expect(h.document.getElementById('hist-side').classList.contains('open')).toBe(true);
    expect(h.document.getElementById('hist-side-search').value).toBe('万里の長城');
  });

  it('トピックバッジ(見どころ等)は従来どおりチャットログモーダルを開く（サイドバーへは埋め込まれない）', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: 'タージ・マハル', distance_km: 10, country_flag: '🇮🇳' }] },
        keywordsCheck: { hits: { 'タージ・マハル': ['見どころ'] } },
        search: { results: [] },
      })
    );
    h.window.fetch = ((orig) => (url: string, opts?: unknown) => {
      if (String(url).indexOf('/api/aichat/shares/by-keyword') !== -1) {
        h.fetchCalls.push(String(url));
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ results: [] }) });
      }
      return orig(url, opts);
    })(h.window.fetch);

    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    const topicBadge = inner.querySelector('.acc-topic-badge');
    expect(topicBadge).toBeTruthy();
    topicBadge.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    expect(h.document.getElementById('hist-side').classList.contains('open')).toBe(false);
    expect(h.document.getElementById('heritage-chatlog-modal-overlay').classList.contains('open')).toBe(true);
  });
});

describe('世界遺産アクセスランキング: 「キーワード」バッジの表記と、モーダル内キーワードのサイドバー連携', () => {
  it('「キーワード」バッジには総数が「キーワード (◯)」の形式で表示される', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: 'タージ・マハル', distance_km: 10, country_flag: '🇮🇳' }] },
        keywordsCheck: { hits: {} },
        searchKeywords: { keywordCounts: { 'タージ・マハル': 3 } },
      })
    );
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    const kwBadge = inner.querySelector('.acc-kw-badge');
    expect(kwBadge).toBeTruthy();
    expect(kwBadge.textContent).toBe('キーワード (3)');
  });

  it('総数が0のときはバッジが表示されない', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: 'タージ・マハル', distance_km: 10, country_flag: '🇮🇳' }] },
        keywordsCheck: { hits: {} },
        searchKeywords: { keywordCounts: { 'タージ・マハル': 0 } },
      })
    );
    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    expect(inner.querySelector('.acc-kw-badge')).toBeFalsy();
  });

  it('「キーワード」バッジをタップして開いたモーダル内の各キーワードは最小幅の角丸バッジで表示される', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: 'タージ・マハル', distance_km: 10, country_flag: '🇮🇳' }] },
        keywordsCheck: { hits: {} },
        searchKeywords: { keywordCounts: { 'タージ・マハル': 2 } },
        search: { results: [] },
      })
    );
    h.window.fetch = ((orig) => (url: string, opts?: unknown) => {
      if (String(url).indexOf('/api/aichat/heritage-search-keyword-counts') !== -1) {
        h.fetchCalls.push(String(url));
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ keywords: [{ keyword: 'インド 世界遺産', count: 5 }, { keyword: '霊廟', count: 2 }] }),
        });
      }
      return orig(url, opts);
    })(h.window.fetch);

    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    const kwBadge = inner.querySelector('.acc-kw-badge');
    kwBadge.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    const items = h.document.querySelectorAll('.kw-panel-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('インド 世界遺産 (5)');
    // 幅固定ではなく最小幅（inline-blockでコンテンツ幅に収まる）であること
    expect(h.window.getComputedStyle(items[0]).display).toBe('inline-block');
  });

  it('モーダル内のキーワードをタップするとモーダルが閉じ、左サイドパネルの検索窓にそのキーワードで検索結果が表示される', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: 'タージ・マハル', distance_km: 10, country_flag: '🇮🇳' }] },
        keywordsCheck: { hits: {} },
        searchKeywords: { keywordCounts: { 'タージ・マハル': 1 } },
      })
    );
    h.window.fetch = ((orig) => (url: string, opts?: unknown) => {
      const u = String(url);
      if (u.indexOf('/api/aichat/heritage-search-keyword-counts') !== -1) {
        h.fetchCalls.push(u);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ keywords: [{ keyword: 'インド 世界遺産', count: 5 }] }) });
      }
      if (u.indexOf('/api/aichat/shares/search') !== -1) {
        h.fetchCalls.push(u);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ results: [{ id: 's1', question: '「タージ・マハル」の「見どころ」について説明してください', answer: '白亜の霊廟です。', model: 'm', created_at: '2026-01-01T00:00:00.000Z', access_count: 0 }] }),
        });
      }
      return orig(url, opts);
    })(h.window.fetch);

    const tr = h.openCity();
    await flush();
    const inner = tr.nextSibling.querySelector('.accordion-inner');
    inner.querySelector('.acc-kw-badge').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    const kwItem = h.document.querySelector('.kw-panel-item');
    expect(kwItem).toBeTruthy();
    kwItem.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await waitDebounce();

    expect(h.document.getElementById('heritage-kw-panel-overlay').classList.contains('open')).toBe(false);
    expect(h.document.getElementById('hist-side').classList.contains('open')).toBe(true);
    expect(h.document.getElementById('hist-side-search').value).toBe('インド 世界遺産');
    expect(h.document.querySelectorAll('.hist-side-item').length).toBe(1);
  });
});
