import { it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { JSDOM } from 'jsdom';
import { getCodexQuestionTreePage } from './codexQuestionTree';

function setup(fail = false, newCategory = false) {
  const sql = new DatabaseSync(':memory:');
  sql.exec('CREATE TABLE mappings(keyword TEXT, category_id INTEGER); CREATE TABLE categories(id INTEGER, name TEXT, color TEXT)');
  if (!newCategory) sql.prepare('INSERT INTO categories VALUES(1,?,?)').run('開発', '#336699');
  let savePending: (() => void) | undefined;
  const fetcher = vi.fn(async (url: any, options: any) => {
    if (String(url) === '/api/aichat/keyword-category-map') {
      const body = JSON.parse(options.body);
      return new Promise(resolve => { savePending = () => {
        if (!fail) for (const id of body.category_ids) sql.prepare('INSERT INTO mappings VALUES(?,?)').run(body.keyword, id);
        resolve({ ok: !fail, status: fail ? 500 : 200, json: async () => fail ? { error: '保存失敗' } : { ok: true } });
      }; });
    }
    if (String(url) === '/api/aichat/keyword-categories' && options?.method === 'POST') {
      const body = JSON.parse(options.body);
      sql.prepare('INSERT INTO categories VALUES(1,?,?)').run(body.name, body.color);
      return { ok: true, json: async () => ({ category: { id: 1, ...body } }) };
    }
    const category: any = sql.prepare('SELECT * FROM categories WHERE id=1').get();
    const mapped = !!sql.prepare('SELECT 1 FROM mappings WHERE keyword=?').get('MCP');
    const data = String(url).endsWith('/keywords') ? {
      keywords: [{ keyword: 'MCP', count: 9, categoryIds: mapped ? [1] : [] }],
      categories: mapped ? [{ ...category, count: 1 }] : []
    } : String(url).startsWith('/api/aichat/keyword-categories?') ? {
      categories: category ? [{ ...category, is_mapped: mapped }] : []
    } : String(url).endsWith('keyword-category-suggest') ? {} : {
      items: [{ id: 'abc', question: '質問', thread_id: 'thread', created_at: '2026-10-07', has_keywords: true }], nextCursor: null
    };
    return { ok: true, json: async () => data };
  });
  const dom = new JSDOM(getCodexQuestionTreePage(), { runScripts: 'dangerously', url: 'https://example.test', beforeParse(window) {
    window.fetch = fetcher as any;
    window.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); };
    window.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
  } });
  return { dom, sql, fetcher, release: () => savePending!() };
}

it.each([{ fail: false, newCategory: false }, { fail: true, newCategory: false }, { fail: false, newCategory: true }])('long press persists classification and refreshes colors: %j', async ({ fail, newCategory }) => {
  const { dom, sql, fetcher, release } = setup(fail, newCategory);
  try {
    const doc = dom.window.document;
    await vi.waitFor(() => expect(doc.querySelector('.keyword-key')).not.toBeNull());
    (doc.querySelector('.keyword-key') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(doc.querySelector('.keyword-badge')).not.toBeNull());
    const link = doc.querySelector('.keyword-badge') as HTMLAnchorElement;
    link.dispatchEvent(new dom.window.MouseEvent('pointerdown', { button: 0, bubbles: true }));
    await vi.waitFor(() => expect(doc.querySelector('dialog[data-overlay]')).not.toBeNull(), { timeout: 1500 });
    link.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true }));
    link.click();
    const modal = doc.querySelector('dialog[data-overlay]') as HTMLDialogElement;
    expect(modal.open).toBe(true);
    expect((doc.getElementById('keyword-dialog') as HTMLDialogElement).open).toBe(true);
    if (newCategory) {
      const input = modal.querySelector('input') as HTMLInputElement;
      input.value = '開発'; input.dispatchEvent(new dom.window.Event('input'));
    } else {
      await vi.waitFor(() => expect(modal.querySelector('[data-cat-id="1"]')).not.toBeNull());
      (modal.querySelector('[data-cat-id="1"] > span') as HTMLSpanElement).click();
    }
    (modal.querySelector('.kwcat-decide-btn') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === '/api/aichat/keyword-category-map')).toBe(true));
    expect(sql.prepare('SELECT * FROM mappings').all()).toHaveLength(0);
    expect(modal.isConnected).toBe(true);
    release();
    if (fail) {
      await vi.waitFor(() => expect(modal.textContent).toContain('分類を保存できませんでした: 保存失敗'));
      expect(modal.isConnected).toBe(true);
      expect(doc.querySelectorAll('.keyword-category-highlight')).toHaveLength(0);
    } else {
      await vi.waitFor(() => expect(doc.querySelector('.keyword-badge')?.classList.contains('keyword-category-highlight')).toBe(true));
      expect(sql.prepare('SELECT * FROM mappings').all()).toEqual([{ keyword: 'MCP', category_id: 1 }]);
      expect((doc.querySelector('.keyword-badge') as HTMLElement).style.backgroundColor).toBe(newCategory ? 'rgb(99, 102, 241)' : 'rgb(51, 102, 153)');
      expect(doc.querySelector('.keyword-category')?.textContent).toBe('(1)開発');
      expect(modal.isConnected).toBe(false);
    }
  } finally { dom.window.close(); sql.close(); }
});

it('does not open classification when a press is canceled by movement', async () => {
  const { dom, sql } = setup();
  try {
    const doc = dom.window.document;
    await vi.waitFor(() => expect(doc.querySelector('.keyword-key')).not.toBeNull());
    (doc.querySelector('.keyword-key') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(doc.querySelector('.keyword-badge')).not.toBeNull());
    const link = doc.querySelector('.keyword-badge')!;
    link.dispatchEvent(new dom.window.MouseEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 }));
    link.dispatchEvent(new dom.window.MouseEvent('pointermove', { clientX: 50, clientY: 0 }));
    await new Promise(resolve => setTimeout(resolve, 650));
    expect(doc.querySelector('dialog[data-overlay]')).toBeNull();
  } finally { dom.window.close(); sql.close(); }
});
