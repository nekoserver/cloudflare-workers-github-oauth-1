import { describe, it, expect, vi } from 'vitest';
import { askTunnelSigner, resolveAskgkCommand } from './tunnelSignerAsk';

function makeFetcher(fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return { fetch: vi.fn(fetchImpl) };
}

function sendResultResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

describe('askTunnelSigner', () => {
  it.each(['mygw', 'mynw'])('設定した%sへ質問を送信する', async (host) => {
    const url = `https://${host}.nekomaneki.work/lib/api/tunnels`;
    const fetcher = makeFetcher(async (_input, init) => {
      const sent = JSON.parse(String(init?.body));
      expect(sent.url).toBe(url);
      expect(JSON.parse(sent.body).message).toBe('codex_prompt="質問"');
      return sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: 'ok' }) });
    });
    await askTunnelSigner(fetcher, 'codex_prompt="質問"', url);
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('tunnels応答のreplyフィールドをそのまま返す', async () => {
    const fetcher = makeFetcher(async () =>
      sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: 'にゃーん' }) })
    );
    const result = await askTunnelSigner(fetcher, 'げんき？');
    expect(result.reply).toBe('にゃーん');
  });

  it('改行を含むreplyもそのまま(改行を潰さず)返す', async () => {
    const replyWithNewlines = '1行目\n2行目\n\n3行目';
    const fetcher = makeFetcher(async () =>
      sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: replyWithNewlines }) })
    );
    const result = await askTunnelSigner(fetcher, '質問');
    expect(result.reply).toBe(replyWithNewlines);
  });

  // 対象: tunnels.rbが2026-10-07〜応答JSON本体に追加したllm_model/llm_effort。
  // ヘッダ(X-LLM-Engine等)はService Binding越しのJSON文字列ラッピングの
  // 都中では届かないため、この2フィールドのみ読む。
  it('llm_model/llm_effortフィールドがあればそのまま返す', async () => {
    const fetcher = makeFetcher(async () =>
      sendResultResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({ reply: 'にゃーん', llm_model: 'claude-sonnet-5-5', llm_effort: 'medium' }),
      })
    );
    const result = await askTunnelSigner(fetcher, 'げんき？');
    expect(result).toEqual({ reply: 'にゃーん', llmModel: 'claude-sonnet-5-5', llmEffort: 'medium' });
  });

  it('llm_model/llm_effortが無い場合はundefinedになる(無い情報を書かない)', async () => {
    const fetcher = makeFetcher(async () =>
      sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: 'にゃーん' }) })
    );
    const result = await askTunnelSigner(fetcher, 'げんき？');
    expect(result.llmModel).toBeUndefined();
    expect(result.llmEffort).toBeUndefined();
  });

  it('llm_model/llm_effortが空文字や非文字列の場合もundefinedになる', async () => {
    const fetcher = makeFetcher(async () =>
      sendResultResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({ reply: 'にゃーん', llm_model: '', llm_effort: 42 }),
      })
    );
    const result = await askTunnelSigner(fetcher, 'げんき？');
    expect(result.llmModel).toBeUndefined();
    expect(result.llmEffort).toBeUndefined();
  });

  it('Service Bindingのfetch()に/tunnel-signer/sendパスとmessageを含むJSON本文を渡す(公開fetchは使わない)', async () => {
    const fetcher = makeFetcher(async (input, init) => {
      expect(String(input)).toContain('/tunnel-signer/send');
      const sentBody = JSON.parse(String(init?.body));
      expect(sentBody.url).toBe('https://mygw.nekomaneki.work/lib/api/tunnels');
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

  it('"tunnels-list"は"cf tunnels list"へ変換してtunnelsへ渡す', async () => {
    const fetcher = makeFetcher(async (_input, init) => {
      const sentBody = JSON.parse(String(init?.body));
      const innerPayload = JSON.parse(sentBody.body);
      expect(innerPayload.message).toBe('cf tunnels list');
      return sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: 'ok' }) });
    });
    await askTunnelSigner(fetcher, 'tunnels-list');
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

  it('"settings"は半角スペースを含まない「設定状況」へ変換してtunnelsへ渡す', async () => {
    const fetcher = makeFetcher(async (_input, init) => {
      const sentBody = JSON.parse(String(init?.body));
      const innerPayload = JSON.parse(sentBody.body);
      expect(innerPayload.message).toBe('設定状況');
      return sendResultResponse({ ok: true, status: 200, body: JSON.stringify({ reply: 'ok' }) });
    });
    await askTunnelSigner(fetcher, 'settings');
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

  it('"settings"を「設定状況」へ変換する(半角スペースを含む表現を打たせないための措置)', () => {
    expect(resolveAskgkCommand('settings')).toBe('設定状況');
  });

  it('"tunnels-list"を"cf tunnels list"へ変換する(models-listと同じパターン)', () => {
    expect(resolveAskgkCommand('tunnels-list')).toBe('cf tunnels list');
  });

  /**
   * "sysstats"・"routines"はsettingsと異なり、先方(tunnels側Bot)がそのままの
   * 英単語を受け取っても内部的に解釈できるため、エイリアス変換は不要
   * (ASKGK_COMMAND_ALIASESに登録しない)。ただのデータとしてそのまま
   * tunnel-signer経由で渡ればよく、この「変換せずそのまま通る」こと自体を
   * 回帰として固定する(将来誤ってエイリアス登録してしまうと壊れる動作)。
   */
  it('"sysstats"はエイリアス変換せずそのまま渡す', () => {
    expect(resolveAskgkCommand('sysstats')).toBe('sysstats');
  });

  it('"routines"はエイリアス変換せずそのまま渡す', () => {
    expect(resolveAskgkCommand('routines')).toBe('routines');
  });
});
