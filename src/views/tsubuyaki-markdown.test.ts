import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { getTsubuyakiPage } from './tsubuyaki';
import { buildFreeTextSlackBlocks, isSlackPostTemplateId } from '../utils/freeTextSlackPost';

describe('つぶやきのMarkdownテンプレート', () => {
  it('選択だけでは下書きを変えず、Runで書式サンプルを適用して投稿する', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ ok: true }) });
    const dom = new JSDOM(getTsubuyakiPage('octocat'), {
      url: 'https://example.com/tsubuyaki', runScripts: 'dangerously',
      beforeParse(window) { window.fetch = fetchMock; },
    });
    try {
      const document = dom.window.document;
      const input = document.getElementById('freeText') as HTMLTextAreaElement;
      input.value = '編集中の下書き';
      const button = document.querySelector<HTMLButtonElement>('[data-template="markdown"]');
      expect(button).not.toBeNull();
      button!.click();
      expect(input.value).toBe('編集中の下書き');
      expect(document.getElementById('snippetCode')!.textContent).toContain('*太字*');
      (document.getElementById('applyTemplateButton') as HTMLButtonElement).click();
      const text = input.value;
      for (const sample of ['*太字*', '_斜体_', '~取り消し線~', '`コード`', '```', '> 引用', '• ', '<https://example.com|リンク>']) {
        expect(text).toContain(sample);
      }
      expect(document.getElementById('charCount')!.textContent).toBe(`${text.length} / 3000`);
      expect(document.getElementById('appliedTemplateLabel')!.textContent).toContain('Markdown');
      expect(fetchMock).not.toHaveBeenCalled();
      (document.getElementById('postBtn') as HTMLButtonElement).click();
      await vi.waitFor(() => expect(document.getElementById('statusMsg')!.textContent).toContain('Slackに投稿しました'));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/tsubuyaki');
      expect(JSON.parse(options.body)).toEqual({ text, template: 'markdown' });
      expect(options.credentials).toBe('include');
    } finally { dom.window.close(); }
  });

  it('投稿先でMarkdownを既知のテンプレートとして受理し、mrkdwn本文を保つ', () => {
    expect(isSlackPostTemplateId('markdown')).toBe(true);
    const blocks = buildFreeTextSlackBlocks('octocat', '*太字*\n> 引用', 'markdown');
    expect(blocks?.find(block => block.type === 'section')).toEqual({
      type: 'section', text: { type: 'mrkdwn', text: '*太字*\n> 引用' },
    });
  });
});
