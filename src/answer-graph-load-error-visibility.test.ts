// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAnswerGraphPage } from './views/answerGraph';

// 対象: /answer-graph ページ(src/views/answerGraph.ts)のグラフ読み込み
// (`loadGraph`)のエラー可視化。サーバーが未捕捉例外でHono既定の
// 500プレーンテキストを返した場合、従来はr.json()の解析失敗が一律
// 「通信エラー」に丸められ原因が追えなかった。parseGraphResponseで
// レスポンス本文を解析し、HTTPステータスと本文先頭を画面に出す。
//
// 故障シナリオ:
//   (1) 非JSONの500レスポンスが一律「通信エラー」に丸められ原因が追えない
//   (2) JSONのerrorフィールドが表示されない
//   (3) 正常なJSONレスポンスまでエラー扱いになる

function buildPage(): string {
  return getAnswerGraphPage('testuser', {});
}

function loadParseGraphResponse() {
  const html = buildPage();
  const idx = html.indexOf('function parseGraphResponse');
  const endIdx = html.indexOf('function loadGraph');
  expect(idx).toBeGreaterThan(-1);
  expect(endIdx).toBeGreaterThan(idx);
  const src = html.slice(idx, endIdx);
  const fn = new Function(`${src}\nreturn parseGraphResponse;`);
  return fn() as (status: number, text: string) => { data: unknown; error: string | null };
}

describe('parseGraphResponse: グラフAPIレスポンスの解析とエラー可視化', () => {
  it('正常なJSONはdataとして返しerrorはnullになる', () => {
    const parse = loadParseGraphResponse();
    const result = parse(200, JSON.stringify({ nodes: [], edges: [] }));
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ nodes: [], edges: [] });
  });

  it('errorフィールドを持つJSONはそのメッセージをerrorとして返す', () => {
    const parse = loadParseGraphResponse();
    const result = parse(500, JSON.stringify({ error: 'グラフ構築でサーバーエラーが発生しました: no such column: x' }));
    expect(result.data).toBeNull();
    expect(result.error).toBe('グラフ構築でサーバーエラーが発生しました: no such column: x');
  });

  it('非JSONレスポンス(Hono既定の500等)はHTTPステータスと本文先頭をerrorとして返す', () => {
    const parse = loadParseGraphResponse();
    const result = parse(500, 'Internal Server Error');
    expect(result.data).toBeNull();
    expect(result.error).toBe('HTTP 500 / Internal Server Error');
  });

  it('本文が空でもHTTPステータスだけは表示する', () => {
    const parse = loadParseGraphResponse();
    const result = parse(502, '');
    expect(result.error).toBe('HTTP 502');
  });

  it('長い本文は120文字に切り詰める', () => {
    const parse = loadParseGraphResponse();
    const longBody = 'x'.repeat(500);
    const result = parse(500, longBody);
    expect(result.error!.length).toBeLessThanOrEqual('HTTP 500 / '.length + 120);
  });
});

describe('loadGraphのDOM実動作(jsdom): サーバー500時のエラー表示', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  async function setupWithGraphResponse(status: number, body: string) {
    const html = buildPage();
    document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
    const proto = (window as unknown as { HTMLCanvasElement: { prototype: { getContext: unknown } } }).HTMLCanvasElement.prototype;
    proto.getContext = () => ({
      clearRect: () => {}, beginPath: () => {}, arc: () => {}, fill: () => {}, stroke: () => {}, moveTo: () => {}, lineTo: () => {},
    });
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes('/api/aichat/shares/search')) {
        return Promise.resolve({ json: () => Promise.resolve({ results: [{ id: 's1', question: 'q1', created_at: '2026-01-01T00:00:00.000Z', keywordCount: 1 }] }) });
      }
      if (String(url).includes('/api/aichat/answer-propagation-graph')) {
        return Promise.resolve({ status, text: () => Promise.resolve(body) });
      }
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);

    const scriptSrc = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    // eslint-disable-next-line no-new-func
    new Function(scriptSrc)();

    const seedSearchInput = document.getElementById('seedSearchInput') as HTMLInputElement;
    seedSearchInput.value = 'q';
    seedSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    (document.querySelector('.search-result-row') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    return document.getElementById('graphStatus')!;
  }

  it('非JSON500レスポンスでも「通信エラー」に丸めず、HTTPステータスと本文が表示される', async () => {
    const graphStatus = await setupWithGraphResponse(500, 'Internal Server Error');
    expect(graphStatus.textContent).toContain('HTTP 500');
    expect(graphStatus.textContent).toContain('Internal Server Error');
    expect(graphStatus.textContent).not.toContain('通信エラー');
    expect(graphStatus.className).toContain('err');
  });

  it('JSONのerrorフィールドはそのまま表示される', async () => {
    const graphStatus = await setupWithGraphResponse(500, JSON.stringify({ error: 'グラフ構築でサーバーエラーが発生しました: 詳細XYZ' }));
    expect(graphStatus.textContent).toContain('詳細XYZ');
  });

  it('正常レスポンスはエラー扱いにならずノード件数が表示される', async () => {
    const graphStatus = await setupWithGraphResponse(200, JSON.stringify({
      nodes: [{ id: 'a:s1', type: 'answer', label: 'q1', depth: 0 }],
      edges: [],
    }));
    expect(graphStatus.textContent).toContain('ノード 1 件');
  });
});
