import { it, expect, vi } from 'vitest';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { JSDOM, VirtualConsole } from 'jsdom';

it.each([false, true])('loads and searches logs after a production build (minify=%s)', async (minify) => {
  const result = buildSync({ entryPoints: ['src/views/codexQuestionTree.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, keepNames: true, minify });
  const module = { exports: {} as any };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, createRequire(import.meta.url));
  const errors: Error[] = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(module.exports.getCodexQuestionTreePage(), {
    runScripts: 'dangerously', url: 'https://example.test', virtualConsole: console,
    beforeParse(window) {
      window.fetch = vi.fn(async (url: any) => ({ ok: true, json: async () => String(url).endsWith('/1') ? { answer: '## 回答\n\n**本番ビルド**' } : ({ items: [{ id: 1, question: 'MCPのキーを使うには？', thread_id: 'thread-1', created_at: '2026-10-07' }], nextCursor: null }) })) as any;
    }
  });
  try {
    await vi.waitFor(() => expect(dom.window.document.querySelectorAll('details')).toHaveLength(3));
    const input = dom.window.document.getElementById('search') as HTMLInputElement;
    input.value = 'キー'; input.dispatchEvent(new dom.window.Event('input'));
    expect(dom.window.document.querySelectorAll('details')).toHaveLength(3);
    const question = dom.window.document.querySelectorAll('details')[2];
    question.open = true; question.dispatchEvent(new dom.window.Event('toggle'));
    await vi.waitFor(() => expect(question.querySelector('.markdown-body h2')?.textContent).toBe('回答'));
    expect(question.querySelector('.markdown-body strong')?.textContent).toBe('本番ビルド');
    expect(errors).toEqual([]);
  } finally { dom.window.close(); }
});
