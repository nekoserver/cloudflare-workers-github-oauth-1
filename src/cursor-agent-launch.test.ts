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

  it('履歴の各行に削除ボタン、履歴パネルに検索窓を持つ', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('agentHistorySearch');
    expect(html).toContain('deleteHistoryRow');
    expect(html).toContain('filterHistoryRows');
    expect(html).toContain("method: 'DELETE'");
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

  it('一覧の「レポート」欄はreport_text未抽出でも「未取得」だけで終わらせず、生データのプレビューを表示する', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('buildRawPreview');
    expect(html).toContain('row.report_text || buildRawPreview(row.raw_response)');
  });

  it('履歴読み込み時、終了状態でない行だけ自動でCursor APIへ問い合わせ直す(モーダルを開かなくても状態が最新化されるようにするため)', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    expect(html).toContain('fetchAndRenderHistory');
    expect(html).toContain('!isTerminalStatus(row.agent_status)');
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

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}`, { method: 'DELETE', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);

    const launchCount = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_launch_log WHERE id = ?').get(id) as { c: number };
    expect(launchCount.c).toBe(0);
    const statusCount = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_status_log WHERE launch_id = ?').get(id) as { c: number };
    expect(statusCount.c).toBe(0);
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
