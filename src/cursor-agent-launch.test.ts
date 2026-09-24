import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

// 対象: GET /cursor-agent, POST /api/cursor-agent/launch, GET /api/cursor-agent/history,
// GET /api/cursor-agent/history/:id/timeline, POST /api/cursor-agent/history/:id/refresh,
// DELETE /api/cursor-agent/history/:id。
// フォーム入力(プロンプト・対象リポジトリ)からCursor Background Agent API
// (POST https://api.cursor.com/v1/agents)を起動し、起動後の問答(プロンプト・
// レスポンス)をAIチャット(ai_chat_shares)と同様にD1へ保存、後から一覧取得できる。
//
// テーブル設計: cursor_agent_launch_log(1回の起動=1行、不変)と
// cursor_agent_status_log(その起動に対する状態取得のたびに追記する連鎖。
// ruby_wasm_snippets/ruby_wasm_snippet_verificationsと同じ親子パターン)に
// 分離し、agent_status・run_status・report_text等はJSONブロブのまま持たず
// 個別カラムへ切り出す。
//
// 故障シナリオ:
//   (1) CURSOR_API_KEY未設定でもCursor APIへリクエストしてしまう
//   (2) プロンプトが1文字以下でも実行されてしまう
//   (3) 対象リポジトリが許可リスト外でも実行されてしまう(任意リポジトリへの
//       Agent起動という権限昇格になりうる)
//   (4) 入力チェックを通過したのに、実際のAPI呼び出し結果をD1へ記録しない
//   (5) 他ユーザーの起動履歴が見えてしまう
//   (6) Cursor API呼び出し自体が失敗した場合に握りつぶし、D1に不正な記録を残す
//   (7) 各テーブル未作成(migration未実行)等でD1書き込みが失敗した場合、
//       Cursor Agent自体は起動成功しているのに例外を握りつぶさず
//       500(app.onErrorの「サーバーエラーが発生しました」)を返してしまう
//       (起動自体は成功しているので、ログ記録の失敗だけでユーザーに失敗と
//       見せてはいけない。ルール8: 記録・通知の義務を果たしつつ処理を続行する)
//   (8) 更新のたびにcursor_agent_launch_logを上書きし、状態変化の履歴(連鎖)が
//       失われてしまう(refreshはUPDATEではなくcursor_agent_status_logへの
//       INSERTで追記する)

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub: string) {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

function wrapD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const makeChain = (args: unknown[]) => ({
        async first<T>(): Promise<T | null> {
          const row = stmt.get(...(args as never[]));
          return (row ?? null) as T | null;
        },
        async all<T>(): Promise<{ results?: T[] }> {
          const rows = stmt.all(...(args as never[])) as unknown[];
          return { results: rows as T[] };
        },
        async run(): Promise<{ meta: { changes: number; last_row_id: number } }> {
          const res = stmt.run(...(args as never[]));
          return { meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) } };
        },
        bind(...innerArgs: unknown[]) {
          return makeChain(innerArgs);
        },
      });
      return makeChain([]);
    },
  };
}

function setupDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE cursor_agent_launch_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      repo_full_name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      agent_id TEXT,
      agent_name TEXT,
      agent_url TEXT,
      cursor_response TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE cursor_agent_status_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      launch_id INTEGER NOT NULL REFERENCES cursor_agent_launch_log(id),
      agent_status TEXT,
      run_status TEXT,
      report_text TEXT,
      raw_response TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE cursor_agent_answer_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      launch_id INTEGER NOT NULL UNIQUE REFERENCES cursor_agent_launch_log(id),
      answer_text TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE user_sessions (
      user_id TEXT PRIMARY KEY,
      revoked_at TEXT,
      last_activity_at TEXT
    );
  `);
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
  db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('other-user');
  return db;
}

/** テスト用: launch_log 1行 + 対応するstatus_log 1行(最初の状態)を挿入し、launch_idを返す。 */
function insertLaunchWithStatus(
  db: DatabaseSync,
  opts: {
    userId: string;
    prompt: string;
    agentId: string | null;
    agentName?: string | null;
    agentUrl?: string | null;
    agentStatus?: string | null;
    runStatus?: string | null;
    reportText?: string | null;
    rawResponse: unknown;
    createdAt: string;
  }
): number {
  db.prepare(
    `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, agent_name, agent_url, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(opts.userId, ALLOWED_REPO, opts.prompt, opts.agentId, opts.agentName ?? null, opts.agentUrl ?? null, JSON.stringify(opts.rawResponse), opts.createdAt);
  const launchId = Number((db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id);
  db.prepare(
    `INSERT INTO cursor_agent_status_log (launch_id, agent_status, run_status, report_text, raw_response, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(launchId, opts.agentStatus ?? null, opts.runStatus ?? null, opts.reportText ?? null, JSON.stringify(opts.rawResponse), opts.createdAt);
  return launchId;
}

const ALLOWED_REPO = 'nekoserver/cloudflare-workers-github-oauth-1';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GET /cursor-agent', () => {
  it('ログイン済みならページを返す', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('Cursor Agent');
  });

  it('起動結果はCursor APIの生JSONをそのまま出さず、agent名・ステータス・Cursorへのリンクを組み立てる関数を持つ', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('renderCursorResponse');
    expect(html).toContain('Cursorで進捗を見る');
    expect(html).toContain('agent.url.indexOf(\'https://\') === 0');
  });

  it('履歴の日時はUTCのまま出さず、JSTに換算した上で「JST」と明記する', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('formatJstFromUtcString');
    expect(html).toContain("' JST'");
    expect(html).toContain('日時(JST)');
  });

  it('問答履歴に再読み込みボタンと検索解除ボタンを置かない(検索欄を空にすれば一覧に戻る)', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).not.toContain('agentHistoryReloadBtn');
    expect(html).not.toContain('>再読み込み<');
    expect(html).not.toContain('agentHistorySearchClearBtn');
    expect(html).not.toContain('>解除<');
    expect(html).toContain('最新状態を取得');
    expect(html).toContain('loadHistory()');
  });

  it('履歴の各行に削除ボタン、履歴パネルに検索窓を持つ', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('agentHistorySearch');
    expect(html).toContain('deleteHistoryRow');
    expect(html).toContain("method: 'DELETE'");
  });

  it('履歴検索は画面上の列ではなく回答キャッシュをサーバ側で検索する', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain("'/api/cursor-agent/history?q=' + encodeURIComponent");
    expect(html).toContain('回答・プロンプト・レポートを検索');
    expect(html).toContain('agentHistorySearchBtn');
    expect(html).toContain('agentHistoryPastLogSearchBtn');
    expect(html).toContain('過去ログ検索');
    expect(html).toContain('runAnswerCacheSearch');
    expect(html).toContain('runPastLogSearch');
    expect(html).toContain('/api/cursor-agent/history/past-log-search');
    expect(html).not.toContain('filterHistoryRows');
    expect(html).toContain("historySearchEl.addEventListener('input'");
    expect(html).not.toContain('リポジトリ・Agent ID・プロンプト・応答を検索');
    expect(html).toContain('history-search-error');
    expect(html).not.toContain("errEl.className = 'error-msg'");
  });

  it('各行に「最新状態を取得」ボタンを持ち、/refreshへPOSTする', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('refreshHistoryRow');
    expect(html).toContain('最新状態を取得');
    expect(html).toContain('/refresh');
  });

  it('履歴の各行にAgent ID列を持つ(row.agent_idは取得しているのに画面に一切表示されていなかった不具合の修正)', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('Agent ID');
    expect(html).toContain('row.agent_id');
  });

  it('履歴の各行に状態(agent_status/run_status)を表示する', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('row.agent_status');
    expect(html).toContain('row.run_status');
  });

  it('Agent IDは外部リンクではなく、下線の無いボタンとしてタップ可能で、最上位レイヤーのモーダルを開く(DBの記録を読み出して表示する)', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    // 旧実装は<a href="https://cursor.com/agents/...">で外部アプリへ直接
    // 遷移させていた。タップ時にopenAgentModal()を呼ぶボタンへ変更し、
    // 下線を出さないagent-id-linkクラス(text-decoration: none)にする。
    expect(html).not.toContain('href=\'https://cursor.com/agents/\'');
    expect(html).toContain('openAgentModal');
    expect(html).toContain('agent-id-link');
    expect(html).toContain('text-decoration: none');
    expect(html).toContain('agentDetailModalOverlay');
    expect(html).toContain('/api/cursor-agent/history/');
    expect(html).toContain('/timeline');
  });

  it('モーダルを開いた時、終了状態(FINISHED等)でなければ最新状態を取得し直してからDBの記録を表示し、終了状態なら読み出すだけにする', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('isTerminalStatus');
    expect(html).toContain('TERMINAL_AGENT_STATUSES');
    expect(html).toContain('/refresh');
  });

  it('サーバステータスはRunning=緑、それ以外=黄、通信障害=赤のバッジで表す', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('classifyStatusBadge');
    expect(html).toContain("'green'");
    expect(html).toContain("'yellow'");
    expect(html).toContain("'red'");
    expect(html).toContain('commError');
    expect(html).toContain('status-badge');
  });

  it('モーダルのタイムライン各エントリに生データ(raw_response)を必ず表示する(report_text抽出漏れでも読めるようにするため)', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('row.raw_response');
    expect(html).toContain('生データ(JSON)を見る');
  });

  it('一覧の「レポート」欄には生JSONを絶対に出さない。report_text未抽出時は終了状態かどうかで文言を分けた人間向けメッセージだけを表示する', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).not.toContain('buildRawPreview');
    expect(html).toContain('(まだレポートはありません)');
    expect(html).toContain('(レポートを取得できませんでした。Agent IDから詳細を確認してください)');
  });

  it('履歴読み込み時、終了状態でない行だけ自動でCursor APIへ問い合わせ直す(モーダルを開かなくても状態が最新化されるようにするため)', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('fetchAndRenderHistory');
    expect(html).toContain('!isTerminalStatus(row.agent_status)');
  });

  it('Agent IDタップのモーダルはアプリ先の会話APIから回答文を取得して最上位レイヤーへ埋め込む', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('/conversation');
    expect(html).toContain('renderConversationAnswers');
    expect(html).toContain('agentDetailAnswerBody');
    expect(html).toContain('getNextZ()');
    expect(html).toContain('parseMd(');
    expect(html).toContain('preview-area');
    expect(html).toContain('回答文');
  });

  it('script タグ内の JS に構文エラーがない', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    const scriptRe = /<script>([\s\S]*?)<\/script>/g;
    let m;
    let count = 0;
    while ((m = scriptRe.exec(html)) !== null) {
      count += 1;
      expect(() => {
        new Function(`(function(){\n${m![1]}\n})`);
      }).not.toThrow();
    }
    expect(count).toBeGreaterThan(0);
  });
});

describe('POST /api/cursor-agent/launch', () => {
  it('CURSOR_API_KEY未設定なら400を返し、Cursor APIを呼ばない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db) });

    expect(res.status).toBe(400);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('CURSOR_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('プロンプトが1文字以下なら400を返し、Cursor APIを呼ばない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'A', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('対象リポジトリが許可リスト外なら400を返し、Cursor APIを呼ばない', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: 'someone/unknown-repo' }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('全条件を満たせばCursor APIを呼び、成功結果をlaunch_log+status_logへ保存する(agent_id/agent_name/agent_urlは個別カラム)', async () => {
    // 実際のCursor APIの応答はid・statusがトップレベルではなくagent配下に
    // ネストされている(2026-09-13にユーザーが実際の起動結果として貼った
    // レスポンス実物で確認済み)。
    const cursorApiResponse = {
      agent: { id: 'bc-123', name: '日次報告', status: 'ACTIVE', url: 'https://cursor.com/agents/bc-123' },
      run: { id: 'run-123', status: 'RUNNING' },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(cursorApiResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(200);
    const data = await res.json() as { cursorResponse: unknown; historySaved: boolean; reportText: string | null };
    expect(data.cursorResponse).toEqual(cursorApiResponse);
    expect(data.historySaved).toBe(true);
    expect(data.reportText).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cursor.com/v1/agents');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Basic ' + btoa('key_test:'));
    const body = JSON.parse(init.body as string);
    expect(body.repos[0].url).toBe('https://github.com/' + ALLOWED_REPO);

    const launchRow = db.prepare('SELECT user_id, repo_full_name, prompt, agent_id, agent_name, agent_url FROM cursor_agent_launch_log WHERE user_id = ?').get('user1') as
      { user_id: string; repo_full_name: string; prompt: string; agent_id: string | null; agent_name: string | null; agent_url: string | null };
    expect(launchRow.user_id).toBe('user1');
    expect(launchRow.repo_full_name).toBe(ALLOWED_REPO);
    expect(launchRow.prompt).toBe('READMEを直して');
    expect(launchRow.agent_id).toBe('bc-123');
    expect(launchRow.agent_name).toBe('日次報告');
    expect(launchRow.agent_url).toBe('https://cursor.com/agents/bc-123');

    const statusRow = db.prepare('SELECT agent_status, run_status, report_text FROM cursor_agent_status_log').get() as
      { agent_status: string | null; run_status: string | null; report_text: string | null };
    expect(statusRow.agent_status).toBe('ACTIVE');
    expect(statusRow.run_status).toBe('RUNNING');
    expect(statusRow.report_text).toBeNull();
  });

  it('Cursor APIがエラーを返した場合はD1に記録せずエラーを返す(握りつぶさない)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(502);
    const data = await res.json() as { error: string };
    expect(data.error).toContain('401');

    const row = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_launch_log').get() as { c: number };
    expect(row.c).toBe(0);
  });

  it('D1への記録が失敗して(テーブル未作成等)も、Agent起動自体は成功として返す(500にしない)', async () => {
    const cursorApiResponse = { agent: { id: 'bc-999', status: 'ACTIVE' }, run: { id: 'run-999', status: 'RUNNING' } };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(cursorApiResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    // migration未実行を模した状況: cursor_agent_launch_log等のテーブルを作らないDB
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE user_sessions (user_id TEXT PRIMARY KEY, revoked_at TEXT, last_activity_at TEXT);`);
    db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(200);
    const data = await res.json() as { cursorResponse: unknown; historySaved: boolean };
    expect(data.cursorResponse).toEqual(cursorApiResponse);
    expect(data.historySaved).toBe(false);
  });

  it('agent.summaryが含まれていればreportTextとして返す', async () => {
    const cursorApiResponse = { agent: { id: 'bc-1', status: 'FINISHED', summary: '昨日のコミットは3件でした' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(cursorApiResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ));
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/launch', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'READMEを直して', repoFullName: ALLOWED_REPO }),
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    const data = await res.json() as { reportText: string | null };
    expect(data.reportText).toBe('昨日のコミットは3件でした');

    const statusRow = db.prepare('SELECT report_text FROM cursor_agent_status_log').get() as { report_text: string | null };
    expect(statusRow.report_text).toBe('昨日のコミットは3件でした');
  });
});

describe('GET /api/cursor-agent/history', () => {
  it('自分の起動履歴のみを新しい順で返す(他ユーザーの履歴は含めない)', async () => {
    const db = setupDb();
    insertLaunchWithStatus(db, { userId: 'user1', prompt: '1つ目', agentId: 'bc_1', agentStatus: 'RUNNING', rawResponse: { agent: { id: 'bc_1' } }, createdAt: '2026-09-13 00:00:00' });
    insertLaunchWithStatus(db, { userId: 'user1', prompt: '2つ目', agentId: 'bc_2', agentStatus: 'RUNNING', rawResponse: { agent: { id: 'bc_2' } }, createdAt: '2026-09-13 01:00:00' });
    insertLaunchWithStatus(db, { userId: 'other-user', prompt: '他人の起動', agentId: 'bc_3', agentStatus: 'RUNNING', rawResponse: { agent: { id: 'bc_3' } }, createdAt: '2026-09-13 02:00:00' });

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ prompt: string }> };
    expect(data.rows.map((r) => r.prompt)).toEqual(['2つ目', '1つ目']);
  });

  it('DB未設定でも例外にならず空配列を返す', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: unknown[] };
    expect(data.rows).toEqual([]);
  });

  it('各行にidを含める(削除ボタン・最新状態取得ボタンから参照するため)', async () => {
    const db = setupDb();
    insertLaunchWithStatus(db, { userId: 'user1', prompt: '1件目', agentId: 'bc_1', agentStatus: 'RUNNING', rawResponse: { agent: { id: 'bc_1' } }, createdAt: '2026-09-13 00:00:00' });

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const data = await res.json() as { rows: Array<{ id: number }> };
    expect(typeof data.rows[0].id).toBe('number');
  });

  it('各行に最新のagent_status/run_status/report_textを結合して含める(見つかればテキスト、無ければnull)', async () => {
    const db = setupDb();
    insertLaunchWithStatus(db, {
      userId: 'user1', prompt: '日次報告して', agentId: 'bc-1',
      agentStatus: 'FINISHED', runStatus: 'COMPLETED', reportText: '完了済みレポート',
      rawResponse: { agent: { summary: '完了済みレポート' } }, createdAt: '2026-09-13 00:00:00',
    });
    insertLaunchWithStatus(db, {
      userId: 'user1', prompt: '実行中のもの', agentId: 'bc-2',
      agentStatus: 'RUNNING', runStatus: 'RUNNING', reportText: null,
      rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 01:00:00',
    });

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const data = await res.json() as { rows: Array<{ prompt: string; agent_status: string | null; report_text: string | null }> };
    const finished = data.rows.find((r) => r.prompt === '日次報告して');
    const running = data.rows.find((r) => r.prompt === '実行中のもの');
    expect(finished?.agent_status).toBe('FINISHED');
    expect(finished?.report_text).toBe('完了済みレポート');
    expect(running?.report_text).toBeNull();
  });

  // 対象: 「レポート:未取得」の空欄が無意味で、モーダルを開かずとも表内で
  // 何かしら中身が確認できるようにすべき、という指摘への対応。report_textが
  // 抽出できていなくても、最新のraw_response(生JSON)を一覧APIからも
  // 返すようにする(フロント側でプレビュー表示するため)。
  it('各行に最新のraw_response(生JSON)も含める(report_text未抽出でも一覧でプレビューできるようにするため)', async () => {
    const db = setupDb();
    insertLaunchWithStatus(db, {
      userId: 'user1', prompt: '実行中のもの', agentId: 'bc-2',
      agentStatus: 'RUNNING', runStatus: 'RUNNING', reportText: null,
      rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 01:00:00',
    });

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const data = await res.json() as { rows: Array<{ raw_response: string | null }> };
    expect(JSON.parse(data.rows[0].raw_response!)).toEqual({ agent: { status: 'RUNNING' } });
  });

  it('status_logがまだ1件も無い起動でも例外にならず、各フィールドはnullになる(LEFT JOIN)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, 'status_logなし', 'bc-1', '{}', '2026-09-13 00:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ report_text: string | null; agent_status: string | null }> };
    expect(data.rows[0].report_text).toBeNull();
    expect(data.rows[0].agent_status).toBeNull();
  });

  it('複数回refreshした場合、最新(fetched_at最大)の状態だけを返す', async () => {
    const db = setupDb();
    const launchId = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: '日次報告して', agentId: 'bc-1',
      agentStatus: 'RUNNING', reportText: null,
      rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00',
    });
    db.prepare(
      `INSERT INTO cursor_agent_status_log (launch_id, agent_status, run_status, report_text, raw_response, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(launchId, 'FINISHED', 'COMPLETED', '最新のレポート', '{}', '2026-09-13 05:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const data = await res.json() as { rows: Array<{ agent_status: string | null; report_text: string | null }> };
    expect(data.rows[0].agent_status).toBe('FINISHED');
    expect(data.rows[0].report_text).toBe('最新のレポート');
  });

  it('q指定時は回答キャッシュ本文が一致する履歴を返す(プロンプトに無くてもヒット)', async () => {
    const db = setupDb();
    const matchId = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'プロンプトには出ない起動', agentId: 'bc_ans_1',
      agentStatus: 'FINISHED', reportText: 'レポートにも出ない',
      rawResponse: { agent: { id: 'bc_ans_1' } }, createdAt: '2026-09-13 00:00:00',
    });
    const promptOnlyId = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'UNIQUE_PROMPT_TOKEN を直して', agentId: 'bc_ans_2',
      agentStatus: 'FINISHED', reportText: 'UNIQUE_PROMPT_TOKEN レポート',
      rawResponse: { agent: { id: 'bc_ans_2' } }, createdAt: '2026-09-13 01:00:00',
    });
    const otherId = insertLaunchWithStatus(db, {
      userId: 'other-user', prompt: '他人', agentId: 'bc_ans_3',
      agentStatus: 'FINISHED', reportText: null,
      rawResponse: { agent: { id: 'bc_ans_3' } }, createdAt: '2026-09-13 02:00:00',
    });
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(matchId, '## 完了\n\n**kaleidoscope** を直しました');
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(promptOnlyId, '関係ない回答本文');
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(otherId, '他人の kaleidoscope 回答');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history?q=kaleidoscope', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ id: number; prompt: string }> };
    expect(data.rows.map((r) => r.id)).toEqual([matchId]);
    expect(data.rows[0].prompt).toBe('プロンプトには出ない起動');
    expect((data as { source?: string; query?: string; cacheTotal?: number }).source).toBe('answer_cache');
    expect((data as { query?: string }).query).toBe('kaleidoscope');
    expect((data as { cacheTotal?: number }).cacheTotal).toBe(2);
  });

  it('qがプロンプトにだけある語でも、キャッシュ未作成の行をサーバ側検索で返す', async () => {
    const db = setupDb();
    const cachedId = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'UNIQUE_PROMPT_TOKEN を直して', agentId: 'bc_p_1',
      agentStatus: 'FINISHED', reportText: null,
      rawResponse: { agent: { id: 'bc_p_1' } }, createdAt: '2026-09-13 00:00:00',
    });
    const uncachedId = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'UNIQUE_PROMPT_TOKEN キャッシュなし', agentId: 'bc_p_2',
      agentStatus: 'FINISHED', reportText: null,
      rawResponse: { agent: { id: 'bc_p_2' } }, createdAt: '2026-09-13 01:00:00',
    });
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(cachedId, '回答にはこの語は無い');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history?q=UNIQUE_PROMPT_TOKEN', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const data = await res.json() as { rows: Array<{ id: number }> };
    expect(data.rows.map((r) => r.id).sort()).toEqual([cachedId, uncachedId].sort());
  });

  it('qの英字は大文字小文字を区別せず、%はワイルドカードにしない', async () => {
    const db = setupDb();
    const caseId = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: '大小文字', agentId: 'bc_case',
      agentStatus: 'FINISHED', reportText: null,
      rawResponse: { agent: { id: 'bc_case' } }, createdAt: '2026-09-13 00:00:00',
    });
    const pctId = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'パーセント', agentId: 'bc_pct',
      agentStatus: 'FINISHED', reportText: null,
      rawResponse: { agent: { id: 'bc_pct' } }, createdAt: '2026-09-13 01:00:00',
    });
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(caseId, 'Finished README update');
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(pctId, '進捗は 100% です');

    const auth = await makeAuthHeader('user1');
    const caseRes = await app.request('/api/cursor-agent/history?q=readme', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const caseData = await caseRes.json() as { rows: Array<{ id: number }> };
    expect(caseData.rows.map((r) => r.id)).toEqual([caseId]);

    const pctRes = await app.request('/api/cursor-agent/history?q=' + encodeURIComponent('100%'), { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const pctData = await pctRes.json() as { rows: Array<{ id: number }> };
    expect(pctData.rows.map((r) => r.id)).toEqual([pctId]);
  });

  it('回答キャッシュ表が無い検索は空成功にせずsearchErrorを返す', async () => {
    // 本番D1の文言:
    // 回答キャッシュの検索に失敗しました: D1_ERROR: no such table: cursor_agent_answer_cache: SQLITE_ERROR
    // 表未作成とデータ破損の両方の確認に使う。SPEC.cursor-agent.md 必載。
    // 0140(過去ログ表)を適用しても 0139 が無い限りこの searchError は残る。
    // 画面の列に一致しない語はフォールバック後も0件だが、空成功(searchErrorなし)にはしない。
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE cursor_agent_launch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        repo_full_name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        agent_url TEXT,
        cursor_response TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE cursor_agent_status_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        launch_id INTEGER NOT NULL,
        agent_status TEXT,
        run_status TEXT,
        report_text TEXT,
        raw_response TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE user_sessions (
        user_id TEXT PRIMARY KEY,
        revoked_at TEXT,
        last_activity_at TEXT
      );
    `);
    db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '表なし', 'bc-miss', '{}', '2026-09-13 00:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history?q=anything', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: unknown[]; searchError?: string };
    expect(data.rows).toEqual([]);
    expect(data.searchError).toContain('回答キャッシュの検索に失敗しました');
    expect(data.searchError).toContain('no such table: cursor_agent_answer_cache');
  });

  it('回答キャッシュ表が無くてもプロンプトに一致する行は返し、searchErrorも残す', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE cursor_agent_launch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        repo_full_name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        agent_url TEXT,
        cursor_response TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE cursor_agent_status_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        launch_id INTEGER NOT NULL,
        agent_status TEXT,
        run_status TEXT,
        report_text TEXT,
        raw_response TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE user_sessions (
        user_id TEXT PRIMARY KEY,
        revoked_at TEXT,
        last_activity_at TEXT
      );
    `);
    db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '表なし', 'bc-miss', '{}', '2026-09-13 00:00:00');
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '別件', 'bc-other', '{}', '2026-09-13 01:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history?q=' + encodeURIComponent('表なし'), {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ prompt: string; agent_id: string }>; searchError?: string };
    expect(data.searchError).toContain('回答キャッシュの検索に失敗しました');
    expect(data.searchError).toContain('no such table: cursor_agent_answer_cache');
    expect(data.rows.map((r) => r.prompt)).toEqual(['表なし']);
    expect(data.rows[0].agent_id).toBe('bc-miss');
  });
});

describe('GET /api/cursor-agent/history/:id/timeline', () => {
  it('1件の起動に対する状態取得の連鎖を古い順で返す', async () => {
    const db = setupDb();
    const launchId = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: '日次報告して', agentId: 'bc-1',
      agentStatus: 'RUNNING', runStatus: 'RUNNING', reportText: null,
      rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00',
    });
    db.prepare(
      `INSERT INTO cursor_agent_status_log (launch_id, agent_status, run_status, report_text, raw_response, fetched_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(launchId, 'FINISHED', 'COMPLETED', '最終レポート', '{}', '2026-09-13 05:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${launchId}/timeline`, { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ agent_status: string | null; report_text: string | null }> };
    expect(data.rows.length).toBe(2);
    expect(data.rows[0].agent_status).toBe('RUNNING');
    expect(data.rows[1].agent_status).toBe('FINISHED');
    expect(data.rows[1].report_text).toBe('最終レポート');
  });

  // 対象: 「抽出できたreport_textが無いエントリは画面上で読める情報がゼロに
  // なり、モーダルの意味が無くなる」という指摘への対応。抽出ロジックの
  // 精度に関わらず必ずこの場で読めるよう、DBに保存済みのraw_response
  // (生JSON)を毎エントリに含めて返す。
  it('各エントリにraw_response(生JSON)を含める(report_textが未抽出でも生データをこの場で読めるようにするため)', async () => {
    const db = setupDb();
    const launchId = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: '日次報告して', agentId: 'bc-1',
      agentStatus: 'RUNNING', runStatus: 'RUNNING', reportText: null,
      rawResponse: { agent: { id: 'bc-1', status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00',
    });
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${launchId}/timeline`, { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const data = await res.json() as { rows: Array<{ raw_response: string }> };
    expect(JSON.parse(data.rows[0].raw_response)).toEqual({ agent: { id: 'bc-1', status: 'RUNNING' } });
  });

  it('他ユーザーの起動には404を返す', async () => {
    const db = setupDb();
    const launchId = insertLaunchWithStatus(db, {
      userId: 'other-user', prompt: '他人の起動', agentId: 'bc-1', agentStatus: 'RUNNING',
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${launchId}/timeline`, { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/cursor-agent/history/:id', () => {
  it('自分の履歴行を削除できる(関連するstatus_log行も削除される)', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, { userId: 'user1', prompt: '削除対象', agentId: 'bc_1', agentStatus: 'RUNNING', rawResponse: {}, createdAt: '2026-09-13 00:00:00' });
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(id, 'キャッシュ済み回答');

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}`, { method: 'DELETE', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);

    const launchCount = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_launch_log WHERE id = ?').get(id) as { c: number };
    expect(launchCount.c).toBe(0);
    const statusCount = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_status_log WHERE launch_id = ?').get(id) as { c: number };
    expect(statusCount.c).toBe(0);
    const cacheCount = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_answer_cache WHERE launch_id = ?').get(id) as { c: number };
    expect(cacheCount.c).toBe(0);
  });

  it('他ユーザーの履歴行は削除できない(404、実際には削除されない)', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, { userId: 'other-user', prompt: '他人の起動', agentId: 'bc_3', agentStatus: 'RUNNING', rawResponse: {}, createdAt: '2026-09-13 02:00:00' });

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}`, { method: 'DELETE', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(404);

    const row = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_launch_log WHERE id = ?').get(id) as { c: number };
    expect(row.c).toBe(1);
  });

  it('回答キャッシュテーブルが未作成でも履歴削除は成功し、launch/statusは消える', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE cursor_agent_launch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        repo_full_name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        agent_url TEXT,
        cursor_response TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE cursor_agent_status_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        launch_id INTEGER NOT NULL,
        agent_status TEXT,
        run_status TEXT,
        report_text TEXT,
        raw_response TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE user_sessions (user_id TEXT PRIMARY KEY, revoked_at TEXT, last_activity_at TEXT);
    `);
    db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
    const id = insertLaunchWithStatus(db, { userId: 'user1', prompt: '削除対象', agentId: 'bc_1', agentStatus: 'RUNNING', rawResponse: {}, createdAt: '2026-09-13 00:00:00' });
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}`, { method: 'DELETE', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const launchCount = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_launch_log WHERE id = ?').get(id) as { c: number };
    expect(launchCount.c).toBe(0);
  });

  it('存在しないidを指定した場合も404を返す', async () => {
    const db = setupDb();
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history/999999', { method: 'DELETE', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(404);
  });
});

// 対象: POST /api/cursor-agent/history/:id/refresh。
// launch直後にD1へ保存される状態は、Agentがまだ実行中(RUNNING等)の
// 制御情報でしかなく、実際の作業結果(完了後の状態)ではない。呼び出し元
// (ブラウザ)が後からこのAPIを叩いて、Cursor APIの最新状態を取得し直し、
// cursor_agent_status_logへ追記できるようにする(UPDATEで上書きしない)。
//
// 故障シナリオ:
//   (1) CURSOR_API_KEY未設定でもCursor APIへ問い合わせようとする
//   (2) 他ユーザーの履歴行のagent_idに対して問い合わせできてしまう
//   (3) agent_id自体が記録されていない行に対して問い合わせて例外になる
//   (4) 取得した最新状態をD1へ反映しない(=結局読み出しても古いまま)
//   (5) Cursor APIがエラーを返した場合に握りつぶし、D1を不正な内容で記録する
//   (6) UPDATEで上書きし、直前の状態が失われてしまう(連鎖として残らない)
describe('POST /api/cursor-agent/history/:id/refresh', () => {
  it('agent_idでCursor APIへ最新状態を問い合わせ、status_logへ新しい行を追記する(既存行は上書きしない)', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc_1', agentStatus: 'RUNNING',
      rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00',
    });

    const latestStatus = { agent: { id: 'bc_1', status: 'FINISHED', name: '日次報告' }, run: { status: 'COMPLETED' } };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(latestStatus), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, {
      method: 'POST',
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });

    expect(res.status).toBe(200);
    const data = await res.json() as { cursorResponse: unknown; reportText: string | null };
    expect(data.cursorResponse).toEqual(latestStatus);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cursor.com/v1/agents/bc_1');

    const statusRows = db.prepare('SELECT agent_status, run_status FROM cursor_agent_status_log WHERE launch_id = ? ORDER BY id ASC').all(id) as
      Array<{ agent_status: string | null; run_status: string | null }>;
    expect(statusRows.length).toBe(2);
    expect(statusRows[0].agent_status).toBe('RUNNING');
    expect(statusRows[1].agent_status).toBe('FINISHED');
    expect(statusRows[1].run_status).toBe('COMPLETED');
  });

  it('CURSOR_API_KEY未設定なら400を返し、Cursor APIを呼ばない', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, { userId: 'user1', prompt: 'READMEを直して', agentId: 'bc_1', agentStatus: 'RUNNING', rawResponse: {}, createdAt: '2026-09-13 00:00:00' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, { method: 'POST', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('他ユーザーの履歴行は問い合わせできない(404、Cursor APIも呼ばない)', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, { userId: 'other-user', prompt: '他人の起動', agentId: 'bc_3', agentStatus: 'RUNNING', rawResponse: {}, createdAt: '2026-09-13 02:00:00' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, { method: 'POST', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Cursor APIがエラーを返した場合はstatus_logに追記せずエラーを返す(握りつぶさない)', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, { userId: 'user1', prompt: 'READMEを直して', agentId: 'bc_1', agentStatus: 'RUNNING', rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, { method: 'POST', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(502);

    const statusRows = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_status_log WHERE launch_id = ?').get(id) as { c: number };
    expect(statusRows.c).toBe(1);
  });

  // 対象: 「未取得」(agent_status等が全てnull)の空のstatus_log行がモーダルの
  // タイムラインに増えていく不具合。HTTP自体は200でも本文がJSONとして
  // 解析できない(空・不正な形式)場合、cursorResponseがnullになり
  // extractCursorAgentFieldsも全てnullを返す。これを「取得できた」ものとして
  // status_logへ記録すると、情報量ゼロの行が連鎖に積み上がり続ける
  // (ユーザー報告: 「未取得」の行が意味の無いまま残る)。
  // JSON解析に失敗した場合は通信障害として扱い、status_logへは記録しない。
  it('Cursor APIがHTTP 200でもJSONとして解析できない応答を返した場合はstatus_logに記録せずエラーを返す(空の「未取得」行を積み上げない)', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, { userId: 'user1', prompt: 'READMEを直して', agentId: 'bc_1', agentStatus: 'RUNNING', rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('not json', { status: 200, headers: { 'Content-Type': 'text/plain' } }));
    vi.stubGlobal('fetch', fetchMock);

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, { method: 'POST', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(502);

    const statusRows = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_status_log WHERE launch_id = ?').get(id) as { c: number };
    expect(statusRows.c).toBe(1);
  });

  it('最新状態にsummaryが含まれていればreportTextとして返し、status_logにも保存する', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, { userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-1', agentStatus: 'RUNNING', rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00' });
    const latestStatus = { agent: { id: 'bc-1', status: 'FINISHED', summary: '完了レポート本文' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(latestStatus), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ));

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, { method: 'POST', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    const data = await res.json() as { reportText: string | null };
    expect(data.reportText).toBe('完了レポート本文');

    const latestRow = db.prepare('SELECT report_text FROM cursor_agent_status_log WHERE launch_id = ? ORDER BY id DESC LIMIT 1').get(id) as { report_text: string | null };
    expect(latestRow.report_text).toBe('完了レポート本文');
  });
});

// 対象: GET /api/cursor-agent/history/:id/conversation
// Cursorアプリ(https://cursor.com/agents/{id})相当の会話を
// GET /v0/agents/{id}/conversation から取得し、assistantの回答文だけを返す。
//
// 故障シナリオ:
//   (1) 他ユーザーのlaunch_idで会話を読めてしまう
//   (2) agent_id未記録なのにCursor APIへ空idで問い合わせる
//   (3) CURSOR_API_KEY未設定でも会話APIを呼ぶ
//   (4) Cursor API失敗を握りつぶし、空の回答を成功として返す
describe('GET /api/cursor-agent/history/:id/conversation', () => {
  it('会話APIのassistant_messageだけをanswersとして返す', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-conv-1',
      agentUrl: 'https://cursor.com/agents/bc-conv-1',
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    const conversation = {
      id: 'bc-conv-1',
      messages: [
        { id: 'm1', type: 'user_message', text: 'READMEを直して' },
        { id: 'm2', type: 'assistant_message', text: 'READMEを更新しました' },
      ],
    };
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(conversation), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    );
    vi.stubGlobal('fetch', fetchMock);

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(200);
    const data = await res.json() as { answers: string[] };
    expect(data.answers).toEqual(['READMEを更新しました']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cursor.com/v0/agents/bc-conv-1/conversation',
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it('他ユーザーの履歴は404で、Cursor APIを呼ばない', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'other-user', prompt: '他人', agentId: 'bc-other',
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('agent_id未記録なら400で、Cursor APIを呼ばない', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: null,
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CURSOR_API_KEY未設定なら400で、Cursor APIを呼ばない', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-1',
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Cursor API失敗は502を返し、空のanswersを成功扱いしない', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-1',
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })));
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(502);
    const data = await res.json() as { error?: string; answers?: string[] };
    expect(data.error).toBeTruthy();
    expect(data.answers).toBeUndefined();
  });

  it('キャッシュに回答文があればCursor APIを呼ばずsource=cacheで返す', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-cached',
      agentStatus: 'FINISHED', runStatus: 'COMPLETED',
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    db.prepare(`INSERT INTO cursor_agent_answer_cache (launch_id, answer_text) VALUES (?, ?)`).run(id, '## キャッシュ済み\n\n**本文**');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { answers: string[]; source?: string };
    expect(data.source).toBe('cache');
    expect(data.answers).toEqual(['## キャッシュ済み\n\n**本文**']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('キャッシュが空ならCursor APIを呼び、断片を1本にまとめて回答文だけをキャッシュする', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-merge',
      agentStatus: 'FINISHED', runStatus: 'COMPLETED',
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    const conversation = {
      id: 'bc-merge',
      messages: [
        { id: 'm1', type: 'user_message', text: 'READMEを直して' },
        { id: 'm2', type: 'assistant_message', text: '## 完了' },
        { id: 'm3', type: 'assistant_message', text: '**README**を更新しました' },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(conversation), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(200);
    const data = await res.json() as { answers: string[]; source?: string };
    expect(data.source).toBe('api');
    expect(data.answers).toEqual(['## 完了\n\n**README**を更新しました']);
    const cacheRows = db.prepare('SELECT answer_text FROM cursor_agent_answer_cache WHERE launch_id = ?').all(id) as { answer_text: string }[];
    expect(cacheRows).toHaveLength(1);
    expect(cacheRows[0].answer_text).toBe('## 完了\n\n**README**を更新しました');
    expect(cacheRows[0].answer_text).not.toContain('READMEを直して');
  });

  it('DB上のステータスが古いRUNNINGのままでも、会話取得前にCursor APIのステータスを再取得し、実際は終了していればキャッシュする(本番でcursor_agent_answer_cacheが0件だった実データを踏まえた再発防止テスト)', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-stale',
      agentStatus: 'RUNNING', runStatus: 'RUNNING',
      rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00',
    });
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/conversation')) {
        return Promise.resolve(new Response(JSON.stringify({
          messages: [{ type: 'assistant_message', text: '実際はもう完了していた回答' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        agent: { id: 'bc-stale', status: 'FINISHED' },
        run: { status: 'COMPLETED' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(200);
    const data = await res.json() as { answers: string[]; source?: string };
    expect(data.source).toBe('api');
    expect(data.answers).toEqual(['実際はもう完了していた回答']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.cursor.com/v1/agents/bc-stale',
      expect.objectContaining({ headers: expect.any(Object) })
    );
    const cacheRows = db.prepare('SELECT answer_text FROM cursor_agent_answer_cache WHERE launch_id = ?').all(id) as { answer_text: string }[];
    expect(cacheRows).toHaveLength(1);
    expect(cacheRows[0].answer_text).toBe('実際はもう完了していた回答');
    const statusRows = db.prepare('SELECT agent_status, run_status FROM cursor_agent_status_log WHERE launch_id = ? ORDER BY id DESC').all(id) as { agent_status: string; run_status: string }[];
    expect(statusRows[0].agent_status).toBe('FINISHED');
    expect(statusRows[0].run_status).toBe('COMPLETED');
  });

  it('CURSOR_API_KEY未設定なら、DB上のステータスが古くても追加のステータス問い合わせは行わずキャッシュもしない', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-stale-nokey',
      agentStatus: 'RUNNING', runStatus: 'RUNNING',
      rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('RUNNING中の非空回答はキャッシュせず、次回復帰で再取得できるようにする', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: '実行中', agentId: 'bc-running',
      agentStatus: 'RUNNING', runStatus: 'RUNNING',
      rawResponse: { agent: { status: 'RUNNING' } }, createdAt: '2026-09-13 00:00:00',
    });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({
        messages: [{ type: 'assistant_message', text: 'まだ途中の回答' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )));
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(200);
    const data = await res.json() as { answers: string[]; source?: string };
    expect(data.source).toBe('api');
    expect(data.answers).toEqual(['まだ途中の回答']);
    const cacheCount = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_answer_cache WHERE launch_id = ?').get(id) as { c: number };
    expect(cacheCount.c).toBe(0);
  });

  it('空の回答はキャッシュせず、次回復帰でAPIを再試行できるようにする', async () => {
    const db = setupDb();
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-empty',
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({ messages: [{ type: 'user_message', text: '質問だけ' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )));
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(200);
    const data = await res.json() as { answers: string[] };
    expect(data.answers).toEqual([]);
    const cacheCount = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_answer_cache WHERE launch_id = ?').get(id) as { c: number };
    expect(cacheCount.c).toBe(0);
  });

  it('キャッシュテーブル未作成でもCursor APIの回答は返し、cacheErrorを残す', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE cursor_agent_launch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        repo_full_name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        agent_url TEXT,
        cursor_response TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE cursor_agent_status_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        launch_id INTEGER NOT NULL,
        agent_status TEXT,
        run_status TEXT,
        report_text TEXT,
        raw_response TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE user_sessions (user_id TEXT PRIMARY KEY, revoked_at TEXT, last_activity_at TEXT);
    `);
    db.prepare(`INSERT INTO user_sessions (user_id, revoked_at) VALUES (?, NULL)`).run('user1');
    const id = insertLaunchWithStatus(db, {
      userId: 'user1', prompt: 'READMEを直して', agentId: 'bc-notable',
      agentStatus: 'FINISHED', runStatus: 'COMPLETED',
      rawResponse: {}, createdAt: '2026-09-13 00:00:00',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        messages: [{ type: 'assistant_message', text: 'テーブル無しでも返す' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ));
    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/conversation`, {
      headers: { Authorization: auth },
    }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(200);
    const data = await res.json() as { answers: string[]; cacheError?: string };
    expect(data.answers).toEqual(['テーブル無しでも返す']);
    expect(data.cacheError).toBeTruthy();
  });
});
