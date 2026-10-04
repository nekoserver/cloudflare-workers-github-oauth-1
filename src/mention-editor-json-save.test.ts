import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { getMentionEditorPage } from './views/mentionEditor';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function setup(confirmed = true) {
  const posts: any[] = [];
  const confirmations: string[] = [];
  const dom = new JSDOM(getMentionEditorPage('tester'), {
    runScripts: 'dangerously',
    url: 'https://example.com/mention-editor',
    beforeParse(window) {
      window.confirm = message => { confirmations.push(message); return confirmed; };
      window.fetch = (async (_url: unknown, options: any) => {
        if (options?.method === 'POST') {
          posts.push(JSON.parse(options.body));
          return { ok: true, json: async () => ({ id: 'existing' }) };
        }
        return { ok: true, json: async () => ({ documents: [
          { id: 'existing', title: 'existing.json', config: {} },
        ] }) };
      }) as any;
    },
  });
  await flush();
  const document = dom.window.document;
  const click = (id: string) => (document.getElementById(id) as HTMLButtonElement).click();
  return { dom, document, posts, confirmations, click };
}

describe('mention-editor JSON保存', () => {
  it('JSON読込の横に保存を置き、未読込でも選択したファイルに確認後上書きする', async () => {
    const { dom, document, posts, confirmations, click } = await setup();
    expect(document.getElementById('btnImport')?.nextElementSibling?.id).toBe('btnSaveJson');
    (document.getElementById('savedDocuments') as HTMLSelectElement).value = 'existing';
    const config = JSON.parse((document.getElementById('jsonOut') as HTMLTextAreaElement).value);
    click('btnSaveJson');
    await flush();
    expect(confirmations).toEqual(['「existing.json」に上書き保存しますか？']);
    expect(posts).toEqual([{ id: 'existing', config }]);
    dom.window.close();
  });

  it('上書き確認をキャンセルした場合は保存しない', async () => {
    const { dom, document, posts, click } = await setup(false);
    (document.getElementById('savedDocuments') as HTMLSelectElement).value = 'existing';
    click('btnSaveJson');
    await flush();
    expect(posts).toEqual([]);
    dom.window.close();
  });

  it('新規保存はファイル名を求め、空欄・重複を拒否して使用可能な名前で保存する', async () => {
    const { dom, document, posts, click } = await setup();
    click('btnSaveJson');
    await flush();
    expect((document.getElementById('saveModal') as HTMLElement).hidden).toBe(false);
    const title = document.getElementById('saveTitle') as HTMLInputElement;
    click('btnConfirmSave');
    expect(posts).toEqual([]);
    title.value = 'EXISTING.json';
    title.dispatchEvent(new dom.window.Event('input'));
    expect((document.getElementById('saveActions') as HTMLElement).hidden).toBe(true);
    click('btnConfirmSave');
    expect(posts).toEqual([]);
    title.value = ' new.json ';
    title.dispatchEvent(new dom.window.Event('input'));
    expect((document.getElementById('saveActions') as HTMLElement).hidden).toBe(false);
    click('btnConfirmSave');
    await flush();
    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe('new.json');
    expect(posts[0].id).toBeUndefined();
    expect((document.getElementById('saveModal') as HTMLElement).hidden).toBe(true);
    dom.window.close();
  });
});
