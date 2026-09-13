import { describe, it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import app from './index';
import { createJWT } from './utils/jwt';

// 対象: GET /cursor-agent, POST /api/cursor-agent/launch, GET /api/cursor-agent/history。
// フォーム入力(プロンプト・対象リポジトリ)からCursor Background Agent API
// (POST https://api.cursor.com/v1/agents)を起動し、起動後の問答(プロンプト・
// レスポンス)をAIチャット(ai_chat_shares)と同様にD1へ保存、後から一覧取得できる。
//
// 故障シナリオ:
//   (1) CURSOR_API_KEY未設定でもCursor APIへリクエストしてしまう
//   (2) プロンプトが1文字以下でも実行されてしまう
//   (3) 対象リポジトリが許可リスト外でも実行されてしまう(任意リポジトリへの
//       Agent起動という権限昇格になりうる)
//   (4) 入力チェックを通過したのに、実際のAPI呼び出し結果をD1へ記録しない
//   (5) 他ユーザーの起動履歴が見えてしまう
//   (6) Cursor API呼び出し自体が失敗した場合に握りつぶし、D1に不正な記録を残す
//   (7) cursor_agent_launch_logテーブル未作成(migration未実行)等でD1書き込みが
//       失敗した場合、Cursor Agent自体は起動成功しているのに例外を握りつぶさず
//       500(app.onErrorの「サーバーエラーが発生しました」)を返してしまう
//       (起動自体は成功しているので、ログ記録の失敗だけでユーザーに失敗と
//       見せてはいけない。ルール8: 記録・通知の義務を果たしつつ処理を続行する)

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
      cursor_response TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    // renderCursorResponse: agent.name/status・run.status・agent.urlへのリンクを
    // DOM APIで組み立てるようにし、生JSONは<details>で折りたたむ(ユーザーから
    // 「生JSONをそのまま出されても役に立たない」との指摘を受けて改善)
    expect(html).toContain('renderCursorResponse');
    expect(html).toContain('Cursorで進捗を見る');
    expect(html).toContain('agent.url.indexOf(\'https://\') === 0');
  });

  it('履歴の日時はUTCのまま出さず、JSTに換算した上で「JST」と明記する', async () => {
    const auth = await makeAuthHeader('user1');
    const res = await app.request('/cursor-agent', { headers: { Authorization: auth } }, { JWT_SECRET });
    const html = await res.text();
    // created_atはD1のdatetime('now')でUTC保存されるため、そのまま表示すると
    // JSTと誤解されうる。formatJstFromUtcStringでUTC→JST(+9h)に換算し、
    // 末尾に'JST'を明記した上でテーブルヘッダーも「日時(JST)」にする
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

  it('全条件を満たせばCursor APIを呼び、成功結果をD1へ保存する', async () => {
    // 実際のCursor APIの応答はid・statusがトップレベルではなくagent配下に
    // ネストされている(2026-09-13にユーザーが実際の起動結果として貼った
    // レスポンス実物で確認済み)。この形でagent_idが正しく抽出できることを保証する
    // (トップレベルのidを見る誤った実装のままだとagent_idが常にnullのまま
    //  保存され、履歴の「最新状態を取得」が一切機能しない不具合になっていた)。
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
    const data = await res.json() as { cursorResponse: unknown; historySaved: boolean };
    expect(data.cursorResponse).toEqual(cursorApiResponse);
    expect(data.historySaved).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cursor.com/v1/agents');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Basic ' + btoa('key_test:'));
    const body = JSON.parse(init.body as string);
    expect(body.repos[0].url).toBe('https://github.com/' + ALLOWED_REPO);

    const row = db.prepare('SELECT user_id, repo_full_name, prompt, agent_id, cursor_response FROM cursor_agent_launch_log WHERE user_id = ?').get('user1') as
      { user_id: string; repo_full_name: string; prompt: string; agent_id: string | null; cursor_response: string };
    expect(row.user_id).toBe('user1');
    expect(row.repo_full_name).toBe(ALLOWED_REPO);
    expect(row.prompt).toBe('READMEを直して');
    expect(row.agent_id).toBe('bc-123');
    expect(JSON.parse(row.cursor_response)).toEqual(cursorApiResponse);
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

  it('D1への記録が失敗して(cursor_agent_launch_log未作成等)も、Agent起動自体は成功として返す(500にしない)', async () => {
    const cursorApiResponse = { agent: { id: 'bc-999', status: 'ACTIVE' }, run: { id: 'run-999', status: 'RUNNING' } };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(cursorApiResponse), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    // migration未実行を模した状況: cursor_agent_launch_logテーブルを作らないDB
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
});

describe('GET /api/cursor-agent/history', () => {
  it('自分の起動履歴のみを新しい順で返す(他ユーザーの履歴は含めない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '1つ目', 'bc_1', '{"id":"bc_1"}', '2026-09-13 00:00:00');
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '2つ目', 'bc_2', '{"id":"bc_2"}', '2026-09-13 01:00:00');
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('other-user', ALLOWED_REPO, '他人の起動', 'bc_3', '{"id":"bc_3"}', '2026-09-13 02:00:00');

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

  it('各行にidを含める(削除ボタンから参照するため)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '1件目', 'bc_1', '{"id":"bc_1"}', '2026-09-13 00:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const data = await res.json() as { rows: Array<{ id: number }> };
    expect(typeof data.rows[0].id).toBe('number');
  });
});

describe('DELETE /api/cursor-agent/history/:id', () => {
  it('自分の履歴行を削除できる', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '削除対象', 'bc_1', '{"id":"bc_1"}', '2026-09-13 00:00:00');
    const id = (db.prepare('SELECT id FROM cursor_agent_launch_log').get() as { id: number }).id;

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}`, { method: 'DELETE', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);

    const row = db.prepare('SELECT COUNT(*) as c FROM cursor_agent_launch_log WHERE id = ?').get(id) as { c: number };
    expect(row.c).toBe(0);
  });

  it('他ユーザーの履歴行は削除できない(404、実際には削除されない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('other-user', ALLOWED_REPO, '他人の起動', 'bc_3', '{"id":"bc_3"}', '2026-09-13 02:00:00');
    const id = (db.prepare('SELECT id FROM cursor_agent_launch_log').get() as { id: number }).id;

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
// launch直後にD1へ保存されるcursor_responseは、Agentがまだ実行中(RUNNING等)の
// 制御情報でしかなく、実際の作業結果(完了後の状態)ではない。呼び出し元
// (ブラウザ)が後からこのAPIを叩いて、Cursor APIの最新状態を取得し直し、
// D1の記録も更新できるようにする。
//
// 故障シナリオ:
//   (1) CURSOR_API_KEY未設定でもCursor APIへ問い合わせようとする
//   (2) 他ユーザーの履歴行のagent_idに対して問い合わせできてしまう
//   (3) agent_id自体が記録されていない行に対して問い合わせて例外になる
//   (4) 取得した最新状態をD1へ反映しない(=結局読み出しても古いまま)
//   (5) Cursor APIがエラーを返した場合に握りつぶし、D1を不正な内容で上書きする
describe('POST /api/cursor-agent/history/:id/refresh', () => {
  it('agent_idでCursor APIへ最新状態を問い合わせ、D1のcursor_responseを更新する', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, 'READMEを直して', 'bc_1', '{"agent":{"status":"RUNNING"}}', '2026-09-13 00:00:00');
    const id = (db.prepare('SELECT id FROM cursor_agent_launch_log').get() as { id: number }).id;

    const latestStatus = { agent: { id: 'bc_1', status: 'FINISHED', name: '日次報告' } };
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
    const data = await res.json() as { cursorResponse: unknown };
    expect(data.cursorResponse).toEqual(latestStatus);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cursor.com/v1/agents/bc_1');

    const row = db.prepare('SELECT cursor_response FROM cursor_agent_launch_log WHERE id = ?').get(id) as { cursor_response: string };
    expect(JSON.parse(row.cursor_response)).toEqual(latestStatus);
  });

  it('CURSOR_API_KEY未設定なら400を返し、Cursor APIを呼ばない', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, 'READMEを直して', 'bc_1', '{"agent":{"status":"RUNNING"}}', '2026-09-13 00:00:00');
    const id = (db.prepare('SELECT id FROM cursor_agent_launch_log').get() as { id: number }).id;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, { method: 'POST', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('他ユーザーの履歴行は問い合わせできない(404、Cursor APIも呼ばない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('other-user', ALLOWED_REPO, '他人の起動', 'bc_3', '{"agent":{"status":"RUNNING"}}', '2026-09-13 02:00:00');
    const id = (db.prepare('SELECT id FROM cursor_agent_launch_log').get() as { id: number }).id;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, { method: 'POST', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Cursor APIがエラーを返した場合はD1を上書きせずエラーを返す(握りつぶさない)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, 'READMEを直して', 'bc_1', '{"agent":{"status":"RUNNING"}}', '2026-09-13 00:00:00');
    const id = (db.prepare('SELECT id FROM cursor_agent_launch_log').get() as { id: number }).id;
    const fetchMock = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, { method: 'POST', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    expect(res.status).toBe(502);

    const row = db.prepare('SELECT cursor_response FROM cursor_agent_launch_log WHERE id = ?').get(id) as { cursor_response: string };
    expect(JSON.parse(row.cursor_response)).toEqual({ agent: { status: 'RUNNING' } });
  });
});

// 対象: 「応答内容から回答本体(レポート)を抜き出せていない」という指摘への対応。
// POST /api/cursor-agent/launch・POST /api/cursor-agent/history/:id/refresh・
// GET /api/cursor-agent/historyのいずれも、Cursor応答から
// extractCursorAgentSummaryText()で抜き出したレポート本文をreportText
// (履歴一覧ではreport_text)として返す。見つからない場合はnullを返し、
// 存在しないものをでっち上げない。
describe('reportText: 応答内容からレポート本文を抜き出して返す', () => {
  it('POST /api/cursor-agent/launch: agent.summaryが含まれていればreportTextとして返す', async () => {
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
  });

  it('POST /api/cursor-agent/launch: レポートらしきフィールドが無ければreportTextはnull(でっち上げない)', async () => {
    const cursorApiResponse = { agent: { id: 'bc-1', status: 'RUNNING' } };
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
    expect(data.reportText).toBeNull();
  });

  it('POST /api/cursor-agent/history/:id/refresh: 最新状態にsummaryが含まれていればreportTextとして返す', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, 'READMEを直して', 'bc-1', '{"agent":{"status":"RUNNING"}}', '2026-09-13 00:00:00');
    const id = (db.prepare('SELECT id FROM cursor_agent_launch_log').get() as { id: number }).id;
    const latestStatus = { agent: { id: 'bc-1', status: 'FINISHED', summary: '完了レポート本文' } };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify(latestStatus), { status: 200, headers: { 'Content-Type': 'application/json' } })
    ));

    const auth = await makeAuthHeader('user1');
    const res = await app.request(`/api/cursor-agent/history/${id}/refresh`, { method: 'POST', headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db), CURSOR_API_KEY: 'key_test' });
    const data = await res.json() as { reportText: string | null };
    expect(data.reportText).toBe('完了レポート本文');
  });

  it('GET /api/cursor-agent/history: 各行にreport_textを含める(見つかればテキスト、無ければnull)', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '日次報告して', 'bc-1', JSON.stringify({ agent: { summary: '完了済みレポート' } }), '2026-09-13 00:00:00');
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '実行中のもの', 'bc-2', JSON.stringify({ agent: { status: 'RUNNING' } }), '2026-09-13 01:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    const data = await res.json() as { rows: Array<{ prompt: string; report_text: string | null }> };
    const finished = data.rows.find((r) => r.prompt === '日次報告して');
    const running = data.rows.find((r) => r.prompt === '実行中のもの');
    expect(finished?.report_text).toBe('完了済みレポート');
    expect(running?.report_text).toBeNull();
  });

  it('GET /api/cursor-agent/history: cursor_responseが壊れたJSONでも例外にならずreport_textはnullになる', async () => {
    const db = setupDb();
    db.prepare(
      `INSERT INTO cursor_agent_launch_log (user_id, repo_full_name, prompt, agent_id, cursor_response, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('user1', ALLOWED_REPO, '壊れたJSON', 'bc-1', '{not valid json', '2026-09-13 00:00:00');

    const auth = await makeAuthHeader('user1');
    const res = await app.request('/api/cursor-agent/history', { headers: { Authorization: auth } }, { JWT_SECRET, DB: wrapD1(db) });
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Array<{ report_text: string | null }> };
    expect(data.rows[0].report_text).toBeNull();
  });
});
