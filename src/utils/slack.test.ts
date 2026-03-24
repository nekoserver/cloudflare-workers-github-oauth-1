import { describe, it, expect, vi, afterEach } from 'vitest';
import { postSlackMessage, openSlackModal } from './slack';

describe('postSlackMessage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('text のみで送信できる', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await postSlackMessage({ token: 'xoxb-test', channel: '#general', text: 'hello' });
    expect(result.ok).toBe(true);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toBe('hello');
    expect(body.blocks).toBeUndefined();
  });

  it('blocks を含めて送信できる', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const blocks = [{ type: 'section', text: { type: 'mrkdwn', text: 'test' } }];
    const result = await postSlackMessage({ token: 'xoxb-test', channel: '#general', text: 'fallback', blocks });
    expect(result.ok).toBe(true);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.blocks).toEqual(blocks);
    expect(body.text).toBe('fallback');
  });

  it('Slack API エラー時にerrorを返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'channel_not_found' }), { status: 200 })
    ));

    const result = await postSlackMessage({ token: 'xoxb-test', channel: '#bad', text: 'test' });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('channel_not_found');
  });
});

describe('openSlackModal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('views.open に正しいパラメータを渡す', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const view = { type: 'modal' as const, title: { type: 'plain_text' as const, text: 'Test' }, blocks: [] };
    const result = await openSlackModal({ token: 'xoxb-test', triggerId: 'trigger-123', view });
    expect(result.ok).toBe(true);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://slack.com/api/views.open');
    const body = JSON.parse(opts.body);
    expect(body.trigger_id).toBe('trigger-123');
    expect(body.view).toEqual(view);
  });

  it('API エラー時にerrorを返す', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'invalid_trigger_id' }), { status: 200 })
    ));

    const view = { type: 'modal' as const, title: { type: 'plain_text' as const, text: 'Test' }, blocks: [] };
    const result = await openSlackModal({ token: 'xoxb-test', triggerId: 'bad', view });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_trigger_id');
  });
});
