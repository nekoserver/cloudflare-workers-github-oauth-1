import { describe, expect, it, vi } from 'vitest';
import { askMuseDirect, museDirectDep, MUSE_DIRECT_PATH, type MuseContainer } from './museDirectAsk';

const completion = (content: unknown, model: unknown = 'muse') => JSON.stringify({ model, choices: [{ message: { content } }] });

function container(response: Response | (() => Promise<Response>), status = 'running'): MuseContainer & { fetch: ReturnType<typeof vi.fn> } {
  return {
    getState: vi.fn().mockResolvedValue({ status }),
    fetch: vi.fn(async () => typeof response === 'function' ? response() : response),
  };
}

describe('askMuseDirect', () => {
  it('コンテナの中継先へ、OpenAI互換の形式とBearerキーで送る', async () => {
    const stub = container(new Response(completion('回答本文', 'muse-1.0')));
    const result = await askMuseDirect(stub, 'key-1', '今日は何日？', 5);
    expect(result).toEqual({ ok: true, reply: '回答本文', llmModel: 'muse-1.0' });
    const request = stub.fetch.mock.calls[0][0] as Request;
    expect(new URL(request.url).pathname).toBe(MUSE_DIRECT_PATH);
    expect(request.method).toBe('POST');
    expect(request.headers.get('Authorization')).toBe('Bearer key-1');
    expect(await request.json()).toEqual({ model: 'muse', messages: [{ role: 'user', content: '今日は何日？' }] });
  });

  // 故障想定: stub.fetchは停止中のコンテナを起動する。問い合わせだけで課金を始めない。
  it.each(['stopped', 'stopped_with_code', 'stopping'])('コンテナが%sなら送らず、起動もしない', async (status) => {
    const stub = container(new Response(completion('x')), status);
    expect(await askMuseDirect(stub, 'key', '質問', 5)).toEqual({ ok: false, error: 'container_not_running' });
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('キーが無ければコンテナへ送らない', async () => {
    const stub = container(new Response(completion('x')));
    expect(await askMuseDirect(stub, undefined, '質問', 5)).toEqual({ ok: false, error: 'muse_not_authenticated' });
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('libと同じ上限(16KiB)を超えるプロンプトは送らない。バイト数で数える', async () => {
    const stub = container(new Response(completion('x')));
    expect(await askMuseDirect(stub, 'key', 'あ'.repeat(5462), 5)).toEqual({ ok: false, error: 'prompt_too_large' });
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'muse_authentication_failed'], [403, 'muse_authentication_failed'], [429, 'muse_usage_limit'],
    [500, 'muse_execution_failed'], [502, 'muse_connection_failed'], [504, 'llm_timeout'],
  ])('HTTP %iを%sとして返す', async (status, error) => {
    expect(await askMuseDirect(container(new Response('{}', { status })), 'key', '質問', 5)).toEqual({ ok: false, error });
  });

  it.each([['JSONでない', 'oops'], ['choicesが無い', '{}'], ['本文が文字列でない', completion(1)], ['本文が空白だけ', completion('  ')]])('%s応答を成功にしない', async (_name, body) => {
    expect(await askMuseDirect(container(new Response(body)), 'key', '質問', 5)).toEqual({ ok: false, error: 'muse_execution_failed' });
  });

  it('コンテナへ届かなければ接続失敗を返す', async () => {
    const stub = container(() => Promise.reject(new Error('Network connection lost')));
    expect(await askMuseDirect(stub, 'key', '質問', 5)).toEqual({ ok: false, error: 'muse_connection_failed' });
  });

  it('待ち時間を過ぎたら打ち切る', async () => {
    const stub = container(() => new Promise<Response>(() => {}));
    expect(await askMuseDirect(stub, 'key', '質問', 0.01)).toEqual({ ok: false, error: 'llm_timeout' });
  });

  it('応答のモデル名が不正なら既定のmuseを表示する', async () => {
    expect(await askMuseDirect(container(new Response(completion('回答', 'bad name\n'))), 'key', '質問', 5)).toMatchObject({ ok: true, llmModel: 'muse' });
  });

  it('回答はlibと同じ32KiBで切り、文字を壊さない', async () => {
    const result = await askMuseDirect(container(new Response(completion('あ'.repeat(20000)))), 'key', '質問', 5);
    if (!result.ok) throw new Error(result.error);
    expect(new TextEncoder().encode(result.reply).length).toBeLessThanOrEqual(32768);
    expect(result.reply.endsWith('あ')).toBe(true);
  });
});

describe('museDirectDep', () => {
  const db = (timeout_seconds: number) => ({ prepare: () => ({ first: async () => ({ revision: 1, timeoutSeconds: timeout_seconds }) }) }) as unknown as D1Database;

  it('DEMO_CONTAINERが無ければ機能を無効にする', () => {
    expect(museDirectDep({}, async () => null)).toBeUndefined();
  });

  it('保存済みのaskgk待ち時間を使う', async () => {
    const stub = container(() => new Promise<Response>(() => {}));
    const dep = museDirectDep({ DEMO_CONTAINER: {} as never, MUSE_API_KEY: 'key', DB: db(1) }, async () => stub)!;
    const started = Date.now();
    expect(await dep('質問')).toEqual({ ok: false, error: 'llm_timeout' });
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
