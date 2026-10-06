import { it, expect, vi } from 'vitest';
import { JSDOM, VirtualConsole } from 'jsdom';
import { getCodexQuestionTreePage } from './codexQuestionTree';

it('opens a top layer keyword dialog and jumps from sorted badges into a lazily loaded Markdown answer', async () => {
  const scroll = vi.fn();
  const errors: unknown[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const fetcher = vi.fn(async (url: any) => ({ ok: true, json: async () => {
    if (String(url).endsWith('/keywords')) return { keywords: [{ keyword: 'SQLite', count: 3 }, { keyword: 'MCP', count: 9 }] };
    if (String(url).endsWith('/abc')) return { answer: '## 回答\n\n**MCP**を使います。SQLiteも使います。' };
    return { items: [
      { id: 'abc', question: 'キーワードのある質問', thread_id: 'thread', created_at: '2026-10-07', has_keywords: true },
      { id: 'def', question: 'キーワードのない質問', thread_id: 'thread', created_at: '2026-10-07', has_keywords: false }
    ], nextCursor: null };
  } }));
  const showModal = vi.fn(function(this: HTMLDialogElement) { this.setAttribute('open', ''); });
  const dom = new JSDOM(getCodexQuestionTreePage(), {
    runScripts: 'dangerously', url: 'https://example.test', virtualConsole: console,
    beforeParse(window) {
      window.fetch = fetcher as any;
      window.HTMLDialogElement.prototype.showModal = showModal;
      window.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
      window.HTMLElement.prototype.scrollIntoView = scroll;
    }
  });
  try {
    const doc = dom.window.document;
    await vi.waitFor(() => expect(doc.querySelectorAll('.keyword-key')).toHaveLength(1));
    const key = doc.querySelector('.keyword-key') as HTMLButtonElement;
    expect(key.parentElement?.tagName).toBe('SUMMARY');
    const question = key.closest('details')!;
    key.click();
    expect(question.open).toBe(false);
    await vi.waitFor(() => expect(doc.querySelectorAll('.keyword-badge')).toHaveLength(2));
    expect(showModal).toHaveBeenCalledOnce();
    const dialog = doc.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    const links = doc.querySelectorAll<HTMLAnchorElement>('.keyword-badge');
    expect(Array.from(links).map(a => a.textContent)).toEqual(['MCP(9)', 'SQLite(3)']);
    links[0].click();
    await vi.waitFor(() => expect(question.querySelector('.keyword-hit')?.textContent).toBe('MCP'));
    expect(dialog.open).toBe(false);
    expect(question.open).toBe(true);
    expect(question.parentElement?.closest('details')?.open).toBe(true);
    const mark = question.querySelector('.keyword-hit')!;
    expect(links[0].hash).toBe('#' + mark.id);
    expect(doc.activeElement).toBe(mark);
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    key.click();
    await vi.waitFor(() => expect(doc.querySelectorAll('.keyword-badge')).toHaveLength(2));
    (doc.querySelectorAll('.keyword-badge')[1] as HTMLAnchorElement).click();
    await vi.waitFor(() => expect(question.querySelectorAll('.keyword-hit')).toHaveLength(2));
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/abc'))).toHaveLength(1);
    expect(errors).toEqual([]);
  } finally { dom.window.close(); }
});
