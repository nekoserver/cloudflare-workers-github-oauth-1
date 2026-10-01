import { describe, it, expect, vi } from 'vitest';
import { askTunnelSigner, resolveAskgkCommand } from './tunnelSignerAsk';

function makeFetcher(fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return { fetch: vi.fn(fetchImpl) };
}

function sendResultResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

describe('askTunnelSigner', () => {
  it('tunnels応答のreplyフィールドをそのまま返す', async () => {
    const fetcher = makeFetcher(async () =>
      sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: 'にゃーん' }) })
    );
    const reply = await askTunnelSigner(fetcher, 'げんき？');
    expect(reply).toBe('にゃーん');
  });

  it('改行を含むreplyもそのまま(改行を潰さず)返す', async () => {
    const replyWithNewlines = '1行目\n2行目\n\n3行目';
    const fetcher = makeFetcher(async () =>
      sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: replyWithNewlines }) })
    );
    const reply = await askTunnelSigner(fetcher, '質問');
    expect(reply).toBe(replyWithNewlines);
  });

  it('Service Bindingのfetch()に/tunnel-signer/sendパスとmessageを含むJSON本文を渡す(公開fetchは使わない)', async () => {
    const fetcher = makeFetcher(async (input, init) => {
      expect(String(input)).toContain('/tunnel-signer/send');
      const sentBody = JSON.parse(String(init?.body));
      expect(sentBody.url).toBe('https://mynw.nekomaneki.work/lib/api/tunnels');
      expect(sentBody.contentType).toBe('application/json');
      const innerPayload = JSON.parse(sentBody.body);
      expect(innerPayload.message).toBe('元気？');
      expect(innerPayload.status).toBe('healthy');
      return sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: 'ok' }) });
    });
    await askTunnelSigner(fetcher, '元気？');
  });

  it('rust-worker-sqlx-d1自体がHTTPエラー(非2xx)を返す場合は握りつぶさずエラーを投げる', async () => {
    const fetcher = makeFetcher(async () => new Response('Internal Server Error', { status: 500 }));
    await expect(askTunnelSigner(fetcher, 'x')).rejects.toThrow(/HTTP 500/);
  });

  it('rust-worker-sqlx-d1がerrorフィールド(シークレット未設定等)を返す場合はそのエラー内容を伝える', async () => {
    const fetcher = makeFetcher(async () =>
      sendResultResponse({ error: 'secret ORIGIN_HMAC_SECRET (or HMAC_SECRET) is not configured' })
    );
    await expect(askTunnelSigner(fetcher, 'x')).rejects.toThrow(/ORIGIN_HMAC_SECRET/);
  });

  it('tunnels自体が非2xxを返す場合(sendResult.ok=false)はエラーを投げる', async () => {
    const fetcher = makeFetcher(async () =>
      sendResultResponse({ ok: false, status: 503, body: 'Service Unavailable' })
    );
    await expect(askTunnelSigner(fetcher, 'x')).rejects.toThrow(/503/);
  });

  it('tunnelsの応答本文がJSONとして解釈できない場合はエラーを投げる', async () => {
    const fetcher = makeFetcher(async () => sendResultResponse({ ok: true, status: 200, body: 'not json' }));
    await expect(askTunnelSigner(fetcher, 'x')).rejects.toThrow(/JSON/);
  });

  it('replyフィールドが無い場合はエラーを投げる(空文字を握りつぶさない)', async () => {
    const fetcher = makeFetcher(async () =>
      sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ status: 'healthy' }) })
    );
    await expect(askTunnelSigner(fetcher, 'x')).rejects.toThrow(/reply/);
  });

  it('"models-list"は"cf ai models list"へ変換してtunnelsへ渡す', async () => {
    const fetcher = makeFetcher(async (_input, init) => {
      const sentBody = JSON.parse(String(init?.body));
      const innerPayload = JSON.parse(sentBody.body);
      expect(innerPayload.message).toBe('cf ai models list');
      return sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: 'ok' }) });
    });
    await askTunnelSigner(fetcher, 'models-list');
  });

  it('エイリアス前後の空白は無視して変換する', async () => {
    const fetcher = makeFetcher(async (_input, init) => {
      const sentBody = JSON.parse(String(init?.body));
      const innerPayload = JSON.parse(sentBody.body);
      expect(innerPayload.message).toBe('cf ai models list');
      return sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: 'ok' }) });
    });
    await askTunnelSigner(fetcher, '  models-list  ');
  });
});

describe('resolveAskgkCommand', () => {
  it('登録済みエイリアスを実コマンドへ変換する', () => {
    expect(resolveAskgkCommand('models-list')).toBe('cf ai models list');
  });

  /** 故障シナリオ: エイリアス表に無い自由記述の質問文まで書き換えてしまうと、
   * 通常の/neko askgk <質問文>が意図しないコマンド扱いになってしまう。 */
  it('未登録の文字列は変換せずそのまま返す', () => {
    expect(resolveAskgkCommand('げんき？')).toBe('げんき？');
  });

  it('前後の空白を取り除いてから照合する', () => {
    expect(resolveAskgkCommand('  models-list  ')).toBe('cf ai models list');
  });

  it('大文字小文字は区別する(完全一致のみ変換)', () => {
    expect(resolveAskgkCommand('Models-List')).toBe('Models-List');
  });
});
