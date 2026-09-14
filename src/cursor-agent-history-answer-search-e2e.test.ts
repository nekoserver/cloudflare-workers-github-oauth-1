import { afterEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { getCursorAgentPage } from './views/cursorAgent';

// 対象: /cursor-agent 問答履歴の検索。入力途中はデバウンス付きインクリメンタル
// で GET /api/cursor-agent/history?q= し、入力完了の「過去ログ検索」は
// POST /api/cursor-agent/history/past-log-search でキーワードとヒット行を保存する。
//
// 故障シナリオ:
//   (1) 初期読み込みの遅延応答が後からの検索結果を上書きする
//   (2) クライアントの filterHistoryRows だけで終わり、APIに q が付かない
//   (3) 入力のたびに過去ログへ保存してしまう
//   (4) searchError を握りつぶして「0件」とだけ出す
//   (5) キャッシュ0件を「検索が壊れている」と区別できない

let dom: JSDOM | undefined;

afterEach(() => {
  if (dom) {
    dom.window.close();
    dom = undefined;
  }
});

function buildDom(fetchImpl: typeof fetch): JSDOM {
  const html = getCursorAgentPage('testuser');
  return new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://example.com/cursor-agent',
    beforeParse(window) {
      window.fetch = fetchImpl as unknown as typeof window.fetch;
    },
  });
}

function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('waitFor timeout'));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}

function historyPath(url: string): { pathname: string; q: string } {
  const parsed = new URL(String(url), 'https://example.com');
  return { pathname: parsed.pathname, q: parsed.searchParams.get('q') || '' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const promptOnlyRow = {
  id: 1,
  repo_full_name: 'nekoserver/cloudflare-workers-github-oauth-1',
  prompt: 'kaleidoscope を直して',
  agent_id: 'bc-prompt-only',
  created_at: '2026-09-13 09:00:00',
  agent_status: 'FINISHED',
  run_status: 'COMPLETED',
  report_text: 'プロンプト側',
  raw_response: '{}',
};
const answerHitRow = {
  id: 2,
  repo_full_name: 'nekoserver/cloudflare-workers-github-oauth-1',
  prompt: '別件の起動',
  agent_id: 'bc-answer-hit',
  created_at: '2026-09-13 10:00:00',
  agent_status: 'FINISHED',
  run_status: 'COMPLETED',
  report_text: 'レポート',
  raw_response: '{}',
};

describe('E2E: 問答履歴検索は回答キャッシュをサーバへ問い合わせる', () => {
  it('入力後デバウンスで ?q= を付けてキャッシュを問い合わせる(キー入力だけでは過去ログへ保存しない)', async () => {
    const fetchUrls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchUrls.push(url);
      const { pathname, q } = historyPath(url);
      if (pathname === '/api/cursor-agent/history') {
        if (q === 'kaleidoscope') {
          return new Response(JSON.stringify({
            rows: [answerHitRow, promptOnlyRow],
            source: 'answer_cache',
            query: 'kaleidoscope',
            cacheTotal: 1,
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ rows: [answerHitRow, promptOnlyRow], source: 'launch_log' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { document } = dom.window;
    await waitFor(() => document.querySelectorAll('.agent-id-link').length === 2);
    const urlsAfterLoad = fetchUrls.filter((u) => historyPath(u).pathname === '/api/cursor-agent/history').length;

    const search = document.getElementById('agentHistorySearch') as HTMLInputElement;
    search.value = 'kaleidoscope';
    search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await sleep(40);
    expect(fetchUrls.filter((u) => historyPath(u).pathname === '/api/cursor-agent/history').length).toBe(urlsAfterLoad);
    expect(fetchUrls.some((u) => String(u).indexOf('/past-log-search') !== -1)).toBe(false);

    await waitFor(() => fetchUrls.some((u) => historyPath(u).q === 'kaleidoscope'));
    await waitFor(() => document.querySelectorAll('.agent-id-link').length === 2);

    const ids = Array.from(document.querySelectorAll('.agent-id-link')).map((el) => el.textContent);
    expect(ids).toEqual(['bc-answer-hit', 'bc-prompt-only']);
    expect(fetchUrls.some((u) => u.indexOf('/api/cursor-agent/history?q=' + encodeURIComponent('kaleidoscope')) !== -1)).toBe(true);
    expect(fetchUrls.some((u) => String(u).indexOf('/past-log-search') !== -1)).toBe(false);
    expect(document.getElementById('agentHistorySearchStatus')?.textContent).toContain('件ヒット');
  });

  it('過去ログ検索ボタンは POST し、ヒットした Agent ID を一覧に出す', async () => {
    const fetchCalls: Array<{ url: string; method: string; body: string }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      fetchCalls.push({ url, method, body: typeof init?.body === 'string' ? init.body : '' });
      const { pathname, q } = historyPath(url);
      if (pathname === '/api/cursor-agent/history/past-log-search' && method === 'POST') {
        return new Response(JSON.stringify({
          rows: [answerHitRow],
          source: 'answer_cache',
          query: 'kaleidoscope',
          cacheTotal: 1,
          savedCount: 1,
          resultCount: 1,
        }), { status: 200 });
      }
      if (pathname === '/api/cursor-agent/history') {
        if (q === 'kaleidoscope') {
          return new Response(JSON.stringify({
            rows: [answerHitRow],
            source: 'answer_cache',
            query: 'kaleidoscope',
            cacheTotal: 1,
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ rows: [answerHitRow, promptOnlyRow], source: 'launch_log' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { document } = dom.window;
    await waitFor(() => document.querySelectorAll('.agent-id-link').length === 2);

    const search = document.getElementById('agentHistorySearch') as HTMLInputElement;
    search.value = 'kaleidoscope';
    (document.getElementById('agentHistoryPastLogSearchBtn') as HTMLButtonElement).click();
    await waitFor(() => fetchCalls.some((c) => c.url.indexOf('/past-log-search') !== -1 && c.method === 'POST'));
    await waitFor(() => document.querySelectorAll('.agent-id-link').length === 1);

    const post = fetchCalls.find((c) => c.url.indexOf('/past-log-search') !== -1);
    expect(post?.body).toContain('kaleidoscope');
    expect(Array.from(document.querySelectorAll('.agent-id-link')).map((el) => el.textContent)).toEqual(['bc-answer-hit']);
    expect(document.getElementById('agentHistorySearchStatus')?.textContent).toContain('過去ログ');
  });

  it('初期読み込みの遅延応答が、後から押したキャッシュ検索の結果を上書きしない', async () => {
    let releaseInitial: (() => void) | undefined;
    const initialGate = new Promise<void>((resolve) => { releaseInitial = resolve; });
    const fetchUrls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchUrls.push(url);
      const { pathname, q } = historyPath(url);
      if (pathname === '/api/cursor-agent/history') {
        if (q === 'kaleidoscope') {
          return new Response(JSON.stringify({
            rows: [answerHitRow],
            source: 'answer_cache',
            query: 'kaleidoscope',
            cacheTotal: 1,
          }), { status: 200 });
        }
        await initialGate;
        return new Response(JSON.stringify({ rows: [answerHitRow, promptOnlyRow], source: 'launch_log' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { document } = dom.window;
    await waitFor(() => Boolean(document.getElementById('agentHistorySearchBtn')));

    const search = document.getElementById('agentHistorySearch') as HTMLInputElement;
    search.value = 'kaleidoscope';
    (document.getElementById('agentHistorySearchBtn') as HTMLButtonElement).click();
    await waitFor(() => document.querySelectorAll('.agent-id-link').length === 1);
    expect(Array.from(document.querySelectorAll('.agent-id-link')).map((el) => el.textContent)).toEqual(['bc-answer-hit']);

    releaseInitial?.();
    await sleep(50);
    expect(Array.from(document.querySelectorAll('.agent-id-link')).map((el) => el.textContent)).toEqual(['bc-answer-hit']);
    expect(document.getElementById('agentHistorySearchStatus')?.textContent).toContain('1件ヒット');
  });

  it('searchErrorが返ったら空成功にせずエラー文言を履歴欄へ出す', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const { pathname, q } = historyPath(String(input));
      if (pathname === '/api/cursor-agent/history') {
        if (q) {
          return new Response(JSON.stringify({
            rows: [],
            source: 'answer_cache',
            searchError: '回答キャッシュの検索に失敗しました: no such table',
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ rows: [], source: 'launch_log' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { document } = dom.window;
    await waitFor(() => {
      const body = document.getElementById('agentHistoryBody');
      return Boolean(body && body.textContent && body.textContent.indexOf('まだ起動履歴がありません') !== -1);
    });

    const search = document.getElementById('agentHistorySearch') as HTMLInputElement;
    search.value = 'anything';
    (document.getElementById('agentHistorySearchBtn') as HTMLButtonElement).click();

    await waitFor(() => {
      const body = document.getElementById('agentHistoryBody');
      return Boolean(body && body.textContent && body.textContent.indexOf('回答キャッシュの検索に失敗しました') !== -1);
    });
    expect(document.getElementById('agentHistoryBody')?.textContent).toContain('回答キャッシュの検索に失敗しました');
  });

  it('キャッシュ0件のときは検索壊れではなく未キャッシュだと表示する', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const { pathname, q } = historyPath(String(input));
      if (pathname === '/api/cursor-agent/history') {
        if (q) {
          return new Response(JSON.stringify({
            rows: [],
            source: 'answer_cache',
            query: 'anything',
            cacheTotal: 0,
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ rows: [promptOnlyRow], source: 'launch_log' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { document } = dom.window;
    await waitFor(() => Boolean(document.querySelector('.agent-id-link')));
    (document.getElementById('agentHistorySearch') as HTMLInputElement).value = 'anything';
    (document.getElementById('agentHistorySearchBtn') as HTMLButtonElement).click();
    await waitFor(() => {
      const status = document.getElementById('agentHistorySearchStatus');
      return Boolean(status && status.textContent && status.textContent.indexOf('回答キャッシュは0件') !== -1);
    });
    expect(document.getElementById('agentHistorySearchStatus')?.textContent).toContain('Agent ID');
  });
});
