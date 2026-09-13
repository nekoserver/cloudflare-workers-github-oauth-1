import { afterEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { getCursorAgentPage } from './views/cursorAgent';

// 対象: /cursor-agent の問答履歴で Agent ID をタップしたとき、
// Cursorアプリ(https://cursor.com/agents/{id})相当の会話APIから取った
// 回答文が、最上位レイヤーのモーダル内に埋め込まれること。
//
// 故障シナリオ:
//   (1) Agent IDタップが外部遷移のまま残り、モーダルが開かない
//   (2) 会話APIのanswersがDOMに反映されず、回答欄が「読み込み中」のまま
//   (3) innerHTMLで回答を流し込み、XSSになる
//   (4) z-indexが未設定で他パネルの裏に隠れる

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

describe('E2E: Agent IDタップ → 最上位モーダルに回答文が埋め込まれる', () => {
  it('会話APIのanswersが #agentDetailAnswerBody にtextContentで描画され、モーダルにz-indexが付く', async () => {
    const answerText = 'READMEを更新しました';
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/cursor-agent/history')) {
        return new Response(JSON.stringify({
          rows: [{
            id: 7,
            repo_full_name: 'nekoserver/cloudflare-workers-github-oauth-1',
            prompt: 'READMEを直して',
            agent_id: 'bc-e2e-1',
            agent_url: 'https://cursor.com/agents/bc-e2e-1',
            created_at: '2026-09-13 10:00:00',
            agent_status: 'FINISHED',
            run_status: 'COMPLETED',
            report_text: '起動時レポート',
            raw_response: '{}',
          }],
        }), { status: 200 });
      }
      if (url.indexOf('/conversation') !== -1) {
        return new Response(JSON.stringify({ answers: [answerText] }), { status: 200 });
      }
      if (url.indexOf('/timeline') !== -1) {
        return new Response(JSON.stringify({
          rows: [{
            agent_status: 'FINISHED',
            run_status: 'COMPLETED',
            report_text: '起動時レポート',
            raw_response: '{}',
            fetched_at: '2026-09-13 10:00:00',
          }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { document } = dom.window;
    await waitFor(() => Boolean(document.querySelector('.agent-id-link')));

    const overlay = document.getElementById('agentDetailModalOverlay') as HTMLElement;
    expect(overlay.hidden).toBe(true);

    const agentIdBtn = document.querySelector('.agent-id-link') as HTMLButtonElement;
    expect(agentIdBtn.textContent).toBe('bc-e2e-1');
    agentIdBtn.click();

    await waitFor(() => {
      const body = document.getElementById('agentDetailAnswerBody');
      return Boolean(body && body.textContent && body.textContent.indexOf(answerText) !== -1);
    });

    expect(overlay.hidden).toBe(false);
    expect(Number(overlay.style.zIndex)).toBeGreaterThan(1000);
    const answerBody = document.getElementById('agentDetailAnswerBody') as HTMLElement;
    expect(answerBody.querySelector('.answer-item')?.textContent).toBe(answerText);
    expect(answerBody.innerHTML).not.toContain('<img');
    expect(document.getElementById('agentDetailModalTitle')?.textContent).toBe('Agent: bc-e2e-1');
  });

  it('会話APIが失敗したら空の成功表示にせず、エラーを回答欄へ出す', async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/cursor-agent/history')) {
        return new Response(JSON.stringify({
          rows: [{
            id: 8,
            repo_full_name: 'nekoserver/cloudflare-workers-github-oauth-1',
            prompt: '失敗確認',
            agent_id: 'bc-e2e-err',
            created_at: '2026-09-13 10:00:00',
            agent_status: 'FINISHED',
            report_text: null,
            raw_response: '{}',
          }],
        }), { status: 200 });
      }
      if (url.indexOf('/conversation') !== -1) {
        return new Response(JSON.stringify({ error: 'Cursor APIがエラーを返しました(status 500): boom' }), { status: 502 });
      }
      if (url.indexOf('/timeline') !== -1) {
        return new Response(JSON.stringify({ rows: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;

    dom = buildDom(fetchImpl);
    const { document } = dom.window;
    await waitFor(() => Boolean(document.querySelector('.agent-id-link')));
    (document.querySelector('.agent-id-link') as HTMLButtonElement).click();
    await waitFor(() => {
      const body = document.getElementById('agentDetailAnswerBody');
      return Boolean(body && body.textContent && body.textContent.indexOf('Cursor APIがエラーを返しました') !== -1);
    });
    expect(document.getElementById('agentDetailAnswerBody')?.textContent).toContain('Cursor APIがエラーを返しました');
  });
});
