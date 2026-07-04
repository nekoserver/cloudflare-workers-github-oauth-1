import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getHeritageAccessPage } from './views/heritageAccess';

// ---------------------------------------------------------------------------
// 1. アコーディオン内の各世界遺産名の左にある絵文字アイコンが、地球儀
//    (webglHeritage.ts / HERITAGE_LIST) のアイコンと一致することを検証する。
// 2. AIチャット詳細プレビュー(hist-detail)のキーワードチップのツールチップが
//    「全回答から抽出した数字(重要)」であることを検証する。
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

async function flush(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function waitDebounce(): Promise<void> {
  await new Promise((r) => setTimeout(r, 420));
  await flush();
}

interface Harness {
  window: any;
  document: any;
  fetchCalls: Array<{ url: string; opts?: any }>;
  openCity: (cc?: string) => any;
}

function setupHarness(handler: FetchHandler): Harness {
  const html = getHeritageAccessPage('testuser');
  const script = extractMainScript(html);
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/' });
  const window: any = dom.window;
  const fetchCalls: Array<{ url: string; opts?: any }> = [];

  window.fetch = (url: string, opts?: any) => {
    fetchCalls.push({ url: String(url), opts });
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
    if (url.indexOf('/api/aichat/share-keywords') !== -1) return overrides.shareKeywords ?? { keywords: [] };
    return {};
  };
}

describe('世界遺産アクセスランキング: アコーディオン内アイコンが地球儀のアイコンと一致する', () => {
  it('HERITAGE_LIST 上で🕌が割り当てられている遺産(カイロ歴史地区)は🕌で表示される', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: 'カイロ歴史地区', distance_km: 5, country_flag: '🇪🇬' }] },
      })
    );
    h.openCity('EG');
    await flush();

    const row = h.document.querySelector('.acc-row[data-heritage="カイロ歴史地区"]');
    expect(row).toBeTruthy();
    const emoji = row.querySelector('.acc-emoji');
    expect(emoji.textContent).toBe('🕌');
  });

  it('HERITAGE_LIST 上で🐋が割り当てられている遺産は🐋で表示される（🏛️固定ではない）', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: {
          heritages: [{ heritage_name: 'ワディ・アル・ヒタン（クジラ渓谷）', distance_km: 5, country_flag: '🇪🇬' }],
        },
      })
    );
    h.openCity('EG');
    await flush();

    const row = h.document.querySelector('.acc-row[data-heritage="ワディ・アル・ヒタン（クジラ渓谷）"]');
    const emoji = row.querySelector('.acc-emoji');
    expect(emoji.textContent).toBe('🐋');
  });

  it('HERITAGE_LIST に存在しない遺産名の場合は🏛️にフォールバックする', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: { heritages: [{ heritage_name: '存在しない遺産XYZ', distance_km: 5, country_flag: '' }] },
      })
    );
    h.openCity('FR');
    await flush();

    const row = h.document.querySelector('.acc-row[data-heritage="存在しない遺産XYZ"]');
    const emoji = row.querySelector('.acc-emoji');
    expect(emoji.textContent).toBe('🏛️');
  });

  it('同じ都市に複数遺産がある場合、それぞれ個別のアイコンが表示される', async () => {
    const h = setupHarness(
      defaultHandler({
        cityHeritages: {
          heritages: [
            { heritage_name: 'カイロ歴史地区', distance_km: 5, country_flag: '🇪🇬' },
            { heritage_name: '聖カタリナ地域', distance_km: 8, country_flag: '🇪🇬' },
            { heritage_name: 'アブ・メナ', distance_km: 12, country_flag: '🇪🇬' },
          ],
        },
      })
    );
    h.openCity('EG');
    await flush();

    expect(h.document.querySelector('.acc-row[data-heritage="カイロ歴史地区"] .acc-emoji').textContent).toBe('🕌');
    expect(h.document.querySelector('.acc-row[data-heritage="聖カタリナ地域"] .acc-emoji').textContent).toBe('⛪');
    expect(h.document.querySelector('.acc-row[data-heritage="アブ・メナ"] .acc-emoji').textContent).toBe('🏛️');
  });
});

describe('世界遺産アクセスランキング: AIチャット詳細プレビューのキーワードチップの説明文言', () => {
  it('チップのツールチップが「全回答から抽出した数字(重要)」になっている（旧: 出現回数）', async () => {
    const h = setupHarness(
      defaultHandler({
        search: {
          results: [{ id: 's1', question: 'Q', answer: 'A', model: 'm', created_at: '2026-01-01T00:00:00.000Z', access_count: 0 }],
        },
        shareKeywords: { keywords: [{ keyword: '見どころ', count: 7, is_classified: false }] },
      })
    );
    const search = h.document.getElementById('hist-side-search');
    search.value = 'Q';
    search.dispatchEvent(new h.window.Event('input', { bubbles: true }));
    await waitDebounce();
    h.document.querySelector('.hist-side-item').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    const chip = h.document.querySelector('#hist-detail-keyword-chips .kwcls-chip');
    expect(chip).toBeTruthy();
    expect(chip.title).toContain('全回答から抽出した数字(重要): 7');
    expect(chip.title).not.toContain('出現回数');
  });
});
