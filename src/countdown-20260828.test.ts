/**
 * /countdownページ・関連API(/api/countdown系)の統合テスト。
 *
 * 対象: カレンダーの日付タップから予定日時(ラベル・目標日時)を登録し、
 * ログイン中は画面右下の常時ウィジェットで残り時間を表示する機能。
 * D1(countdown_events, migration 0115)へユーザーごとに保存する。
 *
 * 故障シナリオ:
 *   (1) ラベル・日時のバリデーションを素通りし、不正なデータがD1に保存される
 *   (2) 他ユーザーの予定を取得・削除できてしまう(user_idでの絞り込み漏れ)
 *   (3) /api/countdown/next が過去の予定を返してしまう、または複数該当時に
 *       最も近い予定を選べていない
 *   (4) DB未設定時に例外で500エラーになりページ全体が壊れる
 */
import { describe, it, expect, vi } from 'vitest';
import app from './index';
import { createJWT } from './utils/jwt';

const JWT_SECRET = 'test-secret';

async function makeAuthHeader(sub = 'test-user') {
  const token = await createJWT({ sub, name: 'Test' }, JWT_SECRET);
  return `Bearer ${token}`;
}

type Row = { id: number; user_id: string; label: string; target_at: string; group_id?: string | null };
type StoredRow = Required<Row>;

function createMockDb(initialRows: Row[] = [], options: { hasUserSession?: boolean } = {}) {
  const hasUserSession = options.hasUserSession ?? true;
  const rows: StoredRow[] = initialRows.map((r) => ({ group_id: null, ...r }));
  let nextId = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;

  function makeStatement(sql: string, params: unknown[]) {
    return {
      first: async () => {
        if (sql.includes('user_sessions')) return hasUserSession ? { revoked_at: null } : null;
        return null;
      },
      all: async () => {
        if (sql.includes('SELECT id, label, target_at, group_id FROM countdown_events')) {
          const userId = params[0] as string;
          const matched = rows
            .filter((r) => r.user_id === userId)
            .map((r) => ({ id: r.id, label: r.label, target_at: r.target_at, group_id: r.group_id }));
          return { results: matched };
        }
        if (sql.includes('SELECT id, label, target_at FROM countdown_events')) {
          const userId = params[0] as string;
          const matched = rows
            .filter((r) => r.user_id === userId)
            .sort((a, b) => a.target_at.localeCompare(b.target_at))
            .map((r) => ({ id: r.id, label: r.label, target_at: r.target_at }));
          return { results: matched };
        }
        return { results: [] };
      },
      run: async () => {
        if (sql.includes('INSERT INTO countdown_events')) {
          const [userId, label, targetAt, groupId] = params as [string, string, string, string | null];
          const id = nextId++;
          rows.push({ id, user_id: userId, label, target_at: targetAt, group_id: groupId ?? null });
          return { meta: { last_row_id: id } };
        }
        if (sql.includes('DELETE FROM countdown_events')) {
          const [id, userId] = params as [string, string];
          const idx = rows.findIndex((r) => String(r.id) === String(id) && r.user_id === userId);
          if (idx !== -1) rows.splice(idx, 1);
          return { success: true };
        }
        return { success: true };
      },
    };
  }

  const db = {
    prepare: (sql: string) => ({
      bind: (...params: unknown[]) => makeStatement(sql, params),
    }),
    batch: async (statements: { run: () => Promise<unknown> }[]) => {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
  };
  return { db, rows };
}

describe('POST /api/countdown', () => {
  it('ラベルと日時を指定して予定を登録できる', async () => {
    const { db } = createMockDb();
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/countdown',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '会議', targetAt: '2026-09-01T10:00:00.000Z' }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; label: string };
    expect(body.ok).toBe(true);
    expect(body.label).toBe('会議');
  });

  it('ラベルが空の場合はエラーを返し登録しない', async () => {
    const { db, rows } = createMockDb();
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/countdown',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '  ', targetAt: '2026-09-01T10:00:00.000Z' }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(400);
    expect(rows.length).toBe(0);
  });

  it('日時が不正な場合はエラーを返し登録しない', async () => {
    const { db, rows } = createMockDb();
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/countdown',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '会議', targetAt: 'not-a-date' }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(400);
    expect(rows.length).toBe(0);
  });

  it('user_sessionsに登録が無いユーザー(cf-authのhasAccess判定と同じ基準でNG)は403で拒否し登録しない', async () => {
    const { db, rows } = createMockDb([], { hasUserSession: false });
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/countdown',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: '会議', targetAt: '2026-09-01T10:00:00.000Z' }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('この機能を利用する権限がありません');
    expect(rows.length).toBe(0);
  });
});

describe('GET /api/countdown', () => {
  it('自分の予定だけを日時の昇順で返す(他ユーザーの予定は含まない)', async () => {
    const { db } = createMockDb([
      { id: 1, user_id: 'test-user', label: '遠い予定', target_at: '2026-09-10T00:00:00.000Z' },
      { id: 2, user_id: 'test-user', label: '近い予定', target_at: '2026-09-01T00:00:00.000Z' },
      { id: 3, user_id: 'other-user', label: '他人の予定', target_at: '2026-09-02T00:00:00.000Z' },
    ]);
    const authHeader = await makeAuthHeader('test-user');
    const res = await app.request('/api/countdown', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    const body = (await res.json()) as { events: { id: number; label: string }[] };
    expect(body.events.map((e) => e.label)).toEqual(['近い予定', '遠い予定']);
  });
});

describe('GET /api/countdown/next', () => {
  it('現在時刻より未来の予定のうち最も近いものを1件返す', async () => {
    const { db } = createMockDb([
      { id: 1, user_id: 'test-user', label: '過去の予定', target_at: '2020-01-01T00:00:00.000Z' },
      { id: 2, user_id: 'test-user', label: '遠い未来', target_at: '2099-01-01T00:00:00.000Z' },
      { id: 3, user_id: 'test-user', label: '近い未来', target_at: '2098-01-01T00:00:00.000Z' },
    ]);
    const authHeader = await makeAuthHeader('test-user');
    const res = await app.request('/api/countdown/next', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    const body = (await res.json()) as { event: { label: string } | null };
    expect(body.event?.label).toBe('近い未来');
  });

  it('未来の予定をeventsに近い順ですべて返し、積み上げ表示から漏らさない', async () => {
    const { db } = createMockDb([
      { id: 1, user_id: 'test-user', label: '遠い未来', target_at: '2099-01-01T00:00:00.000Z' },
      { id: 2, user_id: 'test-user', label: '過去', target_at: '2020-01-01T00:00:00.000Z' },
      { id: 3, user_id: 'test-user', label: '近い未来', target_at: '2098-01-01T00:00:00.000Z' },
    ]);
    const authHeader = await makeAuthHeader('test-user');
    const res = await app.request('/api/countdown/next', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    const body = (await res.json()) as { event: { label: string }; events: { label: string }[] };
    expect(body.events.map((event) => event.label)).toEqual(['近い未来', '遠い未来']);
    expect(body.event).toEqual(body.events[0]);
  });

  it('未来の予定が無ければnullを返す', async () => {
    const { db } = createMockDb([
      { id: 1, user_id: 'test-user', label: '過去の予定', target_at: '2020-01-01T00:00:00.000Z' },
    ]);
    const authHeader = await makeAuthHeader('test-user');
    const res = await app.request('/api/countdown/next', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    const body = (await res.json()) as { event: null; events: unknown[] };
    expect(body.event).toBeNull();
    expect(body.events).toEqual([]);
  });

  it('単発登録(group_idなし)の場合はgroupIndex/groupTotalがnullになる', async () => {
    const { db } = createMockDb([
      { id: 1, user_id: 'test-user', label: '単発予定', target_at: '2099-01-01T00:00:00.000Z', group_id: null },
    ]);
    const authHeader = await makeAuthHeader('test-user');
    const res = await app.request('/api/countdown/next', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    const body = (await res.json()) as { event: { groupIndex: number | null; groupTotal: number | null } };
    expect(body.event.groupIndex).toBeNull();
    expect(body.event.groupTotal).toBeNull();
  });

  it('一括登録(同じgroup_id)の場合、最も近い予定のgroupIndex/groupTotalを返す', async () => {
    const { db } = createMockDb([
      { id: 1, user_id: 'test-user', label: '1件目', target_at: '2098-01-01T00:00:00.000Z', group_id: 'g1' },
      { id: 2, user_id: 'test-user', label: '2件目', target_at: '2099-01-01T00:00:00.000Z', group_id: 'g1' },
    ]);
    const authHeader = await makeAuthHeader('test-user');
    const res = await app.request('/api/countdown/next', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    const body = (await res.json()) as { event: { label: string; groupIndex: number | null; groupTotal: number | null } };
    expect(body.event.label).toBe('1件目');
    expect(body.event.groupIndex).toBe(1);
    expect(body.event.groupTotal).toBe(2);
  });
});

describe('POST /api/countdown: 一括登録(events配列)', () => {
  it('2件以上のeventsを一括登録すると同じgroupIdが割り振られる', async () => {
    const { db, rows } = createMockDb();
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/countdown',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [
            { label: '会議A', targetAt: '2026-09-01T09:00:00.000Z' },
            { label: '会議B', targetAt: '2026-09-01T10:00:00.000Z' },
          ],
        }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; events: { id: number; label: string }[]; groupId: string };
    expect(body.ok).toBe(true);
    expect(body.events.map((e) => e.label)).toEqual(['会議A', '会議B']);
    expect(body.groupId).toBeTruthy();
    expect(rows.every((r) => r.group_id === body.groupId)).toBe(true);
  });

  it('events配列に1件だけ含まれる場合はgroup_idを割り振らない(単発登録と同じ扱い)', async () => {
    const { db, rows } = createMockDb();
    const authHeader = await makeAuthHeader();
    await app.request(
      '/api/countdown',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [{ label: '単発', targetAt: '2026-09-01T09:00:00.000Z' }] }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(rows[0].group_id).toBeNull();
  });

  it('一括登録のうち1件でも不正なら何も登録しない(部分登録を避ける)', async () => {
    const { db, rows } = createMockDb();
    const authHeader = await makeAuthHeader();
    const res = await app.request(
      '/api/countdown',
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [
            { label: '正常', targetAt: '2026-09-01T09:00:00.000Z' },
            { label: '', targetAt: '2026-09-01T10:00:00.000Z' },
          ],
        }),
      },
      { JWT_SECRET, DB: db }
    );
    expect(res.status).toBe(400);
    expect(rows.length).toBe(0);
  });
});

describe('DELETE /api/countdown/:id', () => {
  it('自分の予定を削除できる', async () => {
    const { db, rows } = createMockDb([
      { id: 1, user_id: 'test-user', label: '削除対象', target_at: '2026-09-01T00:00:00.000Z' },
    ]);
    const authHeader = await makeAuthHeader('test-user');
    const res = await app.request('/api/countdown/1', { method: 'DELETE', headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    expect(res.status).toBe(200);
    expect(rows.length).toBe(0);
  });

  it('他ユーザーの予定は削除できない(user_id条件で絞り込まれる)', async () => {
    const { db, rows } = createMockDb([
      { id: 1, user_id: 'other-user', label: '他人の予定', target_at: '2026-09-01T00:00:00.000Z' },
    ]);
    const authHeader = await makeAuthHeader('test-user');
    await app.request('/api/countdown/1', { method: 'DELETE', headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    expect(rows.length).toBe(1);
  });
});

describe('GET /countdown', () => {
  it('認証済みの場合はHTMLページを返す', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/countdown', { headers: { Authorization: authHeader } }, { JWT_SECRET });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('カウントダウン');
    expect(html).toContain('id="countdownWidget"');
  });

  it('user_sessionsに登録があるユーザーには登録ボタン(pickerSaveBtn)を表示する', async () => {
    const { db } = createMockDb([], { hasUserSession: true });
    const authHeader = await makeAuthHeader();
    const res = await app.request('/countdown', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    const html = await res.text();
    expect(html).toContain('id="pickerSaveBtn"');
    expect(html).not.toContain('この機能を利用する権限がありません');
  });

  it('user_sessionsに登録が無いユーザー(cf-authのhasAccess判定と同じ基準でNG)には登録ボタンを表示せず、権限が無い旨のメッセージを表示する', async () => {
    const { db } = createMockDb([], { hasUserSession: false });
    const authHeader = await makeAuthHeader();
    const res = await app.request('/countdown', { headers: { Authorization: authHeader } }, { JWT_SECRET, DB: db });
    const html = await res.text();
    expect(html).not.toContain('id="pickerSaveBtn"');
    expect(html).not.toContain('id="pickerAddRowBtn"');
    expect(html).toContain('この機能を利用する権限がありません');
  });

  it('script タグ内のJSに構文エラーがない', async () => {
    const { getCountdownPage } = await import('./views/countdown');
    const html = getCountdownPage('tester', true);
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    expect(() => new Function(m![1])).not.toThrow();
  });

  it('hasAccess=falseの場合もscript タグ内のJSに構文エラーがない(登録ボタン非表示時の分岐)', async () => {
    const { getCountdownPage } = await import('./views/countdown');
    const html = getCountdownPage('tester', false);
    const scriptRe = /<script type="module">([\s\S]*?)<\/script>/;
    const m = html.match(scriptRe);
    expect(m).not.toBeNull();
    expect(() => new Function(m![1])).not.toThrow();
  });

  it('DB未設定でもページ自体は200で返る(APIはエラーメッセージを返すのみ)', async () => {
    const authHeader = await makeAuthHeader();
    const res = await app.request('/countdown', { headers: { Authorization: authHeader } }, { JWT_SECRET });
    expect(res.status).toBe(200);
  });
});
