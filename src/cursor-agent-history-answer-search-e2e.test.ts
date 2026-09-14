import { afterEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { getCursorAgentPage } from './views/cursorAgent';

// 対象: /cursor-agent 問答履歴の検索窓。
// 画面に載っているプロンプト/リポジトリではなく、
// GET /api/cursor-agent/history?q= 経由で cursor_agent_answer_cache.answer_text
// をサーバ側検索すること。
//
// 故障シナリオ:
//   (1) 入力してもクライアントの filterHistoryRows だけで終わり、APIに q が付かない
//   (2) プロンプトにだけある語で行が残る
//   (3) searchError を握りつぶして「0件」とだけ出す

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

describe('E2E: 問答履歴検索は回答キャッシュをサーバへ問い合わせる', () => {
  it('検索語を入れると ?q= 付きで再取得し、プロンプト一致だけの行は出さない', async () => {
    const fetchUrls: string[] = [];
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

    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      fetchUrls.push(url);
      const { pathname, q } = historyPath(url);
      if (pathname === '/api/cursor-agent/history') {
        if (q === 'kaleidoscope') {
          return new Response(JSON.stringify({ rows: [answerHitRow] }), { status: 200 });
        }
        return new Response(JSON.stringify({ rows: [answerHitRow, promptOnlyRow] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { document } = dom.window;
    await waitFor(() => document.querySelectorAll('.agent-id-link').length === 2);

    const search = document.getElementById('agentHistorySearch') as HTMLInputElement;
    search.value = 'kaleidoscope';
    search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    await waitFor(() => fetchUrls.some((u) => historyPath(u).q === 'kaleidoscope'));
    await waitFor(() => document.querySelectorAll('.agent-id-link').length === 1);

    const ids = Array.from(document.querySelectorAll('.agent-id-link')).map((el) => el.textContent);
    expect(ids).toEqual(['bc-answer-hit']);
    expect(fetchUrls.some((u) => u.indexOf('/api/cursor-agent/history?q=' + encodeURIComponent('kaleidoscope')) !== -1)).toBe(true);
  });

  it('searchErrorが返ったら空成功にせずエラー文言を履歴欄へ出す', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const { pathname, q } = historyPath(String(input));
      if (pathname === '/api/cursor-agent/history') {
        if (q) {
          return new Response(JSON.stringify({
            rows: [],
            searchError: '回答キャッシュの検索に失敗しました: no such table',
          }), { status: 200 });
        }
        return new Response(JSON.stringify({ rows: [] }), { status: 200 });
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
    search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

    await waitFor(() => {
      const body = document.getElementById('agentHistoryBody');
      return Boolean(body && body.textContent && body.textContent.indexOf('回答キャッシュの検索に失敗しました') !== -1);
    });
    expect(document.getElementById('agentHistoryBody')?.textContent).toContain('回答キャッシュの検索に失敗しました');
  });
});
