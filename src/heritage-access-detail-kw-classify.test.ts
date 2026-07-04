import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getHeritageAccessPage } from './views/heritageAccess';

// ---------------------------------------------------------------------------
// 世界遺産アクセスランキング左サイドパネルの「AIチャットの詳細プレビュー」
// (hist-detail モーダル) に、AIチャットページ (aichat.ts) の詳細プレビューと
// 同等のキーワード分類機能（📝トグル + キーワードチップ + 新規カテゴリ登録）を
// 移植したことの振る舞いテスト。文字列マッチではなく実DOM(jsdom)でページの
// スクリプトを実行して検証する。
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

async function waitDebounce(): Promise<void> {
  await new Promise((r) => setTimeout(r, 420));
  await flush();
}

interface Harness {
  window: any;
  document: any;
  fetchCalls: Array<{ url: string; opts?: any }>;
}

function setupHarness(handler: FetchHandler): Harness {
  const html = getHeritageAccessPage('testuser');
  const script = extractMainScript(html);
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.com/' });
  const window: any = dom.window;
  const fetchCalls: Array<{ url: string; opts?: any }> = [];

  window.fetch = (url: string, opts?: unknown) => {
    fetchCalls.push({ url: String(url), opts });
    const body = handler(String(url), opts);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body === undefined ? {} : body),
    });
  };

  window.eval(script);
  return { window, document: window.document, fetchCalls };
}

function defaultHandler(overrides: Record<string, any>): FetchHandler {
  return (url: string) => {
    if (url.indexOf('/api/heritage-access-ranking') !== -1) return { rows: [] };
    if (url.indexOf('/api/aichat/shares/search') !== -1) {
      return overrides.search ?? {
        results: [
          { id: 's1', question: '「タージ・マハル」の「見どころ」について説明してください', answer: '白亜の霊廟です。', model: 'm', created_at: '2026-01-01T00:00:00.000Z', access_count: 3 },
        ],
      };
    }
    if (url.indexOf('/api/aichat/share-keywords') !== -1) return overrides.shareKeywords ?? { keywords: [] };
    if (url.indexOf('/api/aichat/keyword-categories?keyword=') !== -1) return overrides.categories ?? { categories: [] };
    if (url.indexOf('/api/aichat/keyword-categories') !== -1) return overrides.newCategory ?? { category: { id: 99, name: 'test' } };
    if (url.indexOf('/api/aichat/keyword-category-map') !== -1) return overrides.map ?? { ok: true };
    return {};
  };
}

function openDetailModal(h: Harness): void {
  const search = h.document.getElementById('hist-side-search');
  search.value = 'タージ';
  search.dispatchEvent(new h.window.Event('input', { bubbles: true }));
}

describe('世界遺産アクセスランキング: AIチャット詳細プレビューのキーワード分類機能（📝ボタン）', () => {
  it('📝トグルボタン(hist-detail-kw-edit-btn)がタイトルより前に配置される', () => {
    const h = setupHarness(defaultHandler({}));
    const html = h.document.body.parentElement.outerHTML;
    const titleIdx = html.indexOf('id="hist-detail-title"');
    const btnIdx = html.indexOf('id="hist-detail-kw-edit-btn"');
    expect(btnIdx).toBeGreaterThan(-1);
    expect(titleIdx).toBeGreaterThan(-1);
    expect(btnIdx).toBeLessThan(titleIdx);
  });

  it('詳細プレビューを開くと /api/aichat/share-keywords をそのレコードの id で呼び、キーワードチップを描画する', async () => {
    const h = setupHarness(
      defaultHandler({
        shareKeywords: { keywords: [{ keyword: '見どころ', count: 5, is_classified: false }, { keyword: '霊廟', count: 2, is_classified: true }] },
      })
    );
    openDetailModal(h);
    await waitDebounce();
    h.document.querySelector('.hist-side-item').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    expect(h.fetchCalls.some((c) => c.url.indexOf('/api/aichat/share-keywords?shareId=s1') !== -1)).toBe(true);
    const chips = h.document.querySelectorAll('#hist-detail-keyword-chips .kwcls-chip');
    expect(chips.length).toBe(2);
    expect(h.document.getElementById('hist-detail-keyword-chips').style.display).toBe('flex');
  });

  it('📝トグルをクリックすると編集モードの見た目(opacity)が切り替わる', () => {
    const h = setupHarness(defaultHandler({}));
    const btn = h.document.getElementById('hist-detail-kw-edit-btn');
    btn.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    expect(btn.style.opacity).toBe('1');
    btn.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    expect(btn.style.opacity).toBe('0.4');
  });

  it('編集モード中に未分類キーワードをタップすると分類モーダル(新しいカテゴリを登録)が開く', async () => {
    const h = setupHarness(
      defaultHandler({
        shareKeywords: { keywords: [{ keyword: '見どころ', count: 5, is_classified: false }] },
      })
    );
    openDetailModal(h);
    await waitDebounce();
    h.document.querySelector('.hist-side-item').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    h.document.getElementById('hist-detail-kw-edit-btn').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    const chip = h.document.querySelector('#hist-detail-keyword-chips .kwcls-chip-unc');
    expect(chip).toBeTruthy();
    chip.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    const overlays = h.document.querySelectorAll('[data-overlay]');
    expect(overlays.length).toBe(1);
    expect(overlays[0].textContent).toContain('新しいカテゴリを登録');
    expect(overlays[0].textContent).toContain('分類決定');
  });

  it('編集モード中でも分類済みキーワードをタップしても分類モーダルは開かない（ハイライトのみ）', async () => {
    const h = setupHarness(
      defaultHandler({
        shareKeywords: { keywords: [{ keyword: '霊廟', count: 2, is_classified: true }] },
      })
    );
    openDetailModal(h);
    await waitDebounce();
    h.document.querySelector('.hist-side-item').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    h.document.getElementById('hist-detail-kw-edit-btn').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    const chip = h.document.querySelector('#hist-detail-keyword-chips .kwcls-chip-cls');
    expect(chip).toBeTruthy();
    chip.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    expect(h.document.querySelectorAll('[data-overlay]').length).toBe(0);
    expect(chip.classList.contains('kwcls-chip-active')).toBe(true);
  });

  it('新規カテゴリ名を入力して「分類決定」を押すとカテゴリ作成APIとマッピングAPIを呼び、モーダルを閉じてチップを再取得する', async () => {
    const h = setupHarness(
      defaultHandler({
        shareKeywords: { keywords: [{ keyword: '見どころ', count: 5, is_classified: false }] },
        newCategory: { category: { id: 42, name: '新カテゴリ' } },
      })
    );
    openDetailModal(h);
    await waitDebounce();
    h.document.querySelector('.hist-side-item').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    h.document.getElementById('hist-detail-kw-edit-btn').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    h.document.querySelector('#hist-detail-keyword-chips .kwcls-chip-unc').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    const overlay = Array.from(h.document.querySelectorAll('[data-overlay]')).find((el: any) => el.textContent.indexOf('新しいカテゴリを登録') !== -1) as any;
    expect(overlay).toBeTruthy();
    const input = overlay.querySelector('input[type="text"]');
    input.value = '新カテゴリ';
    input.dispatchEvent(new h.window.Event('input', { bubbles: true }));

    const decideBtn = Array.from(overlay.querySelectorAll('button')).find((b: any) => b.textContent === '分類決定') as any;
    expect(decideBtn.disabled).toBe(false);
    decideBtn.dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    expect(h.fetchCalls.some((c) => c.url === '/api/aichat/keyword-categories' && c.opts && c.opts.method === 'POST')).toBe(true);
    expect(h.fetchCalls.some((c) => c.url === '/api/aichat/keyword-category-map' && c.opts && c.opts.method === 'POST')).toBe(true);
    const body = JSON.parse(h.fetchCalls.find((c) => c.url === '/api/aichat/keyword-category-map')!.opts.body);
    expect(body.keyword).toBe('見どころ');
    expect(body.category_ids).toContain(42);
    expect(h.document.querySelectorAll('[data-overlay]').length).toBe(0);
    // 保存後に share-keywords を再取得してチップを更新する
    expect(h.fetchCalls.filter((c) => c.url.indexOf('/api/aichat/share-keywords') !== -1).length).toBeGreaterThanOrEqual(2);
  });

  it('モーダルを閉じて再度別レコードを開くと、前回のキーワードチップ・編集モードがリセットされる', async () => {
    const h = setupHarness(
      defaultHandler({
        shareKeywords: { keywords: [{ keyword: '見どころ', count: 5, is_classified: false }] },
      })
    );
    openDetailModal(h);
    await waitDebounce();
    h.document.querySelector('.hist-side-item').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();
    h.document.getElementById('hist-detail-kw-edit-btn').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    expect(h.document.getElementById('hist-detail-kw-edit-btn').style.opacity).toBe('1');

    h.document.getElementById('hist-detail-close').dispatchEvent(new h.window.Event('click', { bubbles: true }));

    h.window.fetch = (url: string) => {
      const body = url.indexOf('/api/aichat/share-keywords') !== -1 ? { keywords: [] } : {};
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    };
    h.document.querySelector('.hist-side-item').dispatchEvent(new h.window.Event('click', { bubbles: true }));
    await flush();

    expect(h.document.getElementById('hist-detail-kw-edit-btn').style.opacity).toBe('0.4');
    expect(h.document.getElementById('hist-detail-keyword-chips').style.display).toBe('none');
  });
});
