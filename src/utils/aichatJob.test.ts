import { describe, it, expect, vi } from 'vitest';
import { AichatJobRunner, AICHAT_JOB_RETENTION_MS, type AichatJobStorage } from './aichatJob';

// ユーザー指定(2026-11-07): AIチャットの応答とその後のログ保存を、タブを閉じたり別ウィンドウへ移ったりしても途切れさせない。
// 生成はブラウザとの接続ではなくDurable Object(AichatJob)のalarmの中で最後まで行い、ブラウザは途中経過を取りに来るだけにする。

class FakeStorage implements AichatJobStorage {
  data = new Map<string, unknown>();
  alarm: number | null = null;
  async get<T>(key: string) { return this.data.get(key) as T | undefined; }
  async put(key: string, value: unknown) { this.data.set(key, structuredClone(value)); }
  async deleteAll() { this.data.clear(); this.alarm = null; }
  async setAlarm(time: number) { this.alarm = time; }
}

const OWNER = 'user-1';
const START = {
  owner: OWNER,
  request: { url: 'https://example.com/api/aichat', headers: { cookie: 'session=abc', 'content-type': 'application/json' }, body: '{"message":"hi"}' },
};

function sse(events: Array<[string, unknown]>) {
  const text = events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  return new Response(text, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Muse-Tailscale': 'connected' } });
}

async function start(runner: AichatJobRunner, body: unknown = START) {
  return runner.fetch(new Request('https://aichat-job/start', { method: 'POST', body: JSON.stringify(body) }));
}
async function status(runner: AichatJobRunner, owner = OWNER, offset = 0) {
  const res = await runner.fetch(new Request(`https://aichat-job/status?owner=${encodeURIComponent(owner)}&offset=${offset}`));
  return { code: res.status, body: await res.json() as Record<string, any> };
}

describe('AichatJobRunner: 接続と切り離した生成', () => {
  it('startは保存とalarmの予約だけをしてすぐ返し、生成はalarmで行う', async () => {
    const storage = new FakeStorage();
    const dispatch = vi.fn(async () => sse([['done', { response: 'x' }]]));
    const runner = new AichatJobRunner(storage, dispatch, () => 1000);
    const res = await start(runner);
    expect(res.status).toBe(202);
    expect(dispatch).not.toHaveBeenCalled();
    expect(storage.alarm).toBe(1000);
    expect((await status(runner)).body.status).toBe('pending');
  });

  it('alarmで元の/api/aichatへ同じヘッダーと本文を送り、ストリームの途中経過と最終結果を保存する', async () => {
    const storage = new FakeStorage();
    const dispatch = vi.fn(async (_req: Request) => sse([
      ['start', { usedModel: 'm1', systemPromptMode: 'ja' }],
      ['delta', { text: 'こん' }],
      ['delta', { text: 'にちは' }],
      ['done', { response: 'こんにちは', usedModel: 'm1', shareId: 's1', threadId: 't1' }],
    ]));
    const runner = new AichatJobRunner(storage, dispatch, () => 1000);
    await start(runner);
    await runner.alarm();
    const req = dispatch.mock.calls[0][0];
    expect(req.url).toBe('https://example.com/api/aichat');
    expect(req.method).toBe('POST');
    expect(req.headers.get('cookie')).toBe('session=abc');
    expect(await req.text()).toBe('{"message":"hi"}');

    const all = await status(runner);
    expect(all.body).toMatchObject({ status: 'done', text: 'こんにちは', textLength: 5 });
    expect(all.body.result).toMatchObject({ response: 'こんにちは', usedModel: 'm1', systemPromptMode: 'ja', shareId: 's1', threadId: 't1', museTailscale: 'connected' });
    expect((await status(runner, OWNER, 2)).body.text).toBe('にちは');
    // 終わったら保持期間の後に消すためのalarmを置く
    expect(storage.alarm).toBe(1000 + AICHAT_JOB_RETENTION_MS);
  });

  it('JSONの応答はステータスに関わらず結果として保存する(エラー表示は今までどおりブラウザが行う)', async () => {
    const storage = new FakeStorage();
    const runner = new AichatJobRunner(storage, async () => Response.json({ error: 'メッセージが空です' }, { status: 400 }), () => 1);
    await start(runner);
    await runner.alarm();
    expect((await status(runner)).body).toMatchObject({ status: 'done', result: { error: 'メッセージが空です' } });
  });

  it('ストリームのerrorイベントと、送信そのものの例外は失敗として理由を残し、alarmは例外を投げない(再実行で二重に保存しない)', async () => {
    const a = new AichatJobRunner(new FakeStorage(), async () => sse([['delta', { text: '途中' }], ['error', { error: 'AIストリームの受信に失敗しました' }]]), () => 1);
    await start(a);
    await expect(a.alarm()).resolves.toBeUndefined();
    expect((await status(a)).body).toMatchObject({ status: 'failed', error: 'AIストリームの受信に失敗しました', text: '途中' });

    const b = new AichatJobRunner(new FakeStorage(), async () => { throw new Error('boom'); }, () => 1);
    await start(b);
    await expect(b.alarm()).resolves.toBeUndefined();
    expect((await status(b)).body).toMatchObject({ status: 'failed', error: 'boom' });
  });

  it('実行中に落ちてalarmが再実行されても、生成をやり直さず中断として失敗にする', async () => {
    const storage = new FakeStorage();
    const dispatch = vi.fn(async () => sse([['done', { response: 'x' }]]));
    const runner = new AichatJobRunner(storage, dispatch, () => 1);
    await start(runner);
    await storage.put('meta', { ...(await storage.get<Record<string, unknown>>('meta')), status: 'running' });
    await runner.alarm();
    expect(dispatch).not.toHaveBeenCalled();
    expect((await status(runner)).body).toMatchObject({ status: 'failed', error: 'interrupted' });
  });

  it('送信者以外には存在も見せず、同じジョブは二度始めない', async () => {
    const runner = new AichatJobRunner(new FakeStorage(), async () => sse([]), () => 1);
    expect((await status(runner)).code).toBe(404);
    await start(runner);
    expect((await status(runner, 'someone-else')).code).toBe(404);
    expect((await start(runner)).status).toBe(409);
    expect((await start(new AichatJobRunner(new FakeStorage(), async () => sse([]), () => 1), { owner: '', request: START.request })).status).toBe(400);
  });

  it('保持期間を過ぎたalarmでジョブのデータを消す', async () => {
    let now = 1;
    const storage = new FakeStorage();
    const runner = new AichatJobRunner(storage, async () => sse([['done', { response: 'x' }]]), () => now);
    await start(runner);
    await runner.alarm();
    now += AICHAT_JOB_RETENTION_MS;
    await runner.alarm();
    expect(storage.data.size).toBe(0);
    expect((await status(runner)).code).toBe(404);
  });
});
