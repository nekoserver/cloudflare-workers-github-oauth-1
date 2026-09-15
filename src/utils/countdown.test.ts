import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeCfAuthDeadlineTargetAt,
  CF_AUTH_DEADLINE_LABEL,
  CF_AUTH_SESSION_TTL_MS,
  upsertCountdownEvent,
  formatCountdownInsertNotice,
  COUNTDOWN_EVENT_INSERT_SQL,
  computeCountdownGroupPosition,
  filterCountdownEventsByDate,
  findNextCountdownEvent,
  findUpcomingCountdownEvents,
  formatCountdownRemaining,
  isValidCountdownLabel,
  isValidCountdownTargetAt,
  type CountdownEventRow,
  type CountdownGroupRow,
  type CountdownInsertDb,
} from './countdown';

describe('computeCfAuthDeadlineTargetAt', () => {
  it('ログイン日時からcf-authのセッション有効期限(7日)ぶん先の日時をISO形式で返す', () => {
    const loginAt = new Date('2026-09-11T09:48:00.000Z');
    const result = computeCfAuthDeadlineTargetAt(loginAt);
    expect(result).toBe('2026-09-18T09:48:00.000Z');
    expect(CF_AUTH_SESSION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('固定ラベルは「cf-auth 期限」', () => {
    expect(CF_AUTH_DEADLINE_LABEL).toBe('cf-auth 期限');
  });
});

describe('isValidCountdownTargetAt', () => {
  it('ISO 8601形式の日時文字列を有効とする', () => {
    expect(isValidCountdownTargetAt('2026-09-01T10:00:00.000Z')).toBe(true);
  });

  it('パース不能な文字列は無効とする', () => {
    expect(isValidCountdownTargetAt('not-a-date')).toBe(false);
    expect(isValidCountdownTargetAt('')).toBe(false);
  });

  it('文字列以外(数値・null・undefined)は無効とする', () => {
    expect(isValidCountdownTargetAt(123)).toBe(false);
    expect(isValidCountdownTargetAt(null)).toBe(false);
    expect(isValidCountdownTargetAt(undefined)).toBe(false);
  });
});

describe('isValidCountdownLabel', () => {
  it('trim後に1〜100文字の文字列を有効とする', () => {
    expect(isValidCountdownLabel('テスト予定')).toBe(true);
    expect(isValidCountdownLabel('a'.repeat(100))).toBe(true);
  });

  it('空文字・空白のみは無効とする', () => {
    expect(isValidCountdownLabel('')).toBe(false);
    expect(isValidCountdownLabel('   ')).toBe(false);
  });

  it('101文字以上は無効とする(暴走した長文入力を弾く)', () => {
    expect(isValidCountdownLabel('a'.repeat(101))).toBe(false);
  });

  it('文字列以外は無効とする', () => {
    expect(isValidCountdownLabel(123)).toBe(false);
    expect(isValidCountdownLabel(null)).toBe(false);
  });
});

describe('findNextCountdownEvent', () => {
  const now = '2026-08-28T12:00:00.000Z';

  it('現在時刻より未来のイベントのうち最も近いものを返す', () => {
    const rows: CountdownEventRow[] = [
      { id: 1, label: '遠い予定', target_at: '2026-09-05T00:00:00.000Z' },
      { id: 2, label: '近い予定', target_at: '2026-08-28T13:00:00.000Z' },
      { id: 3, label: '過去の予定', target_at: '2026-08-27T00:00:00.000Z' },
    ];
    const result = findNextCountdownEvent(rows, now);
    expect(result?.id).toBe(2);
  });

  it('未来のイベントが無ければnullを返す(過去のイベントを誤って返さない)', () => {
    const rows: CountdownEventRow[] = [
      { id: 1, label: '過去の予定', target_at: '2026-08-27T00:00:00.000Z' },
    ];
    expect(findNextCountdownEvent(rows, now)).toBeNull();
  });

  it('空配列ならnullを返す', () => {
    expect(findNextCountdownEvent([], now)).toBeNull();
  });

  it('target_atが不正な行は無視して処理を続行する(1件の不正データで全体を壊さない)', () => {
    const rows: CountdownEventRow[] = [
      { id: 1, label: '壊れた行', target_at: 'not-a-date' },
      { id: 2, label: '正常な行', target_at: '2026-08-28T13:00:00.000Z' },
    ];
    expect(findNextCountdownEvent(rows, now)?.id).toBe(2);
  });
});

describe('findUpcomingCountdownEvents', () => {
  it('不正・過去データを除き、未来の全タイマーを日時順（同時刻はid順）で返す', () => {
    const rows: CountdownEventRow[] = [
      { id: 4, label: '同時刻B', target_at: '2026-09-02T00:00:00.000Z' },
      { id: 1, label: '過去', target_at: '2026-08-01T00:00:00.000Z' },
      { id: 3, label: '同時刻A', target_at: '2026-09-02T00:00:00.000Z' },
      { id: 2, label: '最初', target_at: '2026-09-01T00:00:00.000Z' },
      { id: 5, label: '不正', target_at: 'invalid' },
    ];
    expect(findUpcomingCountdownEvents(rows, '2026-08-28T00:00:00.000Z').map((row) => row.id)).toEqual([2, 3, 4]);
  });
});

describe('formatCountdownRemaining', () => {
  it('日・時・分・秒を含む形式に整形する', () => {
    // 1日2時間3分4秒 = 93784秒
    const ms = ((1 * 24 + 2) * 3600 + 3 * 60 + 4) * 1000;
    expect(formatCountdownRemaining(ms)).toBe('1日 02:03:04');
  });

  it('1日未満は時:分:秒のみにする(日付部分を出さない)', () => {
    const ms = (2 * 3600 + 3 * 60 + 4) * 1000;
    expect(formatCountdownRemaining(ms)).toBe('02:03:04');
  });

  it('残り0以下は00:00:00にする(負のカウントダウンを表示しない)', () => {
    expect(formatCountdownRemaining(0)).toBe('00:00:00');
    expect(formatCountdownRemaining(-1000)).toBe('00:00:00');
  });

  it('各要素を2桁ゼロ埋めする', () => {
    const ms = (1 * 3600 + 2 * 60 + 3) * 1000;
    expect(formatCountdownRemaining(ms)).toBe('01:02:03');
  });
});

describe('computeCountdownGroupPosition', () => {
  it('同じgroup_idを持つ複数件の中で、idの昇順で何番目/何件中かを返す', () => {
    const rows: CountdownGroupRow[] = [
      { id: 10, group_id: 'g1' },
      { id: 11, group_id: 'g1' },
      { id: 12, group_id: 'g1' },
    ];
    expect(computeCountdownGroupPosition(rows, 10)).toEqual({ index: 1, total: 3 });
    expect(computeCountdownGroupPosition(rows, 11)).toEqual({ index: 2, total: 3 });
    expect(computeCountdownGroupPosition(rows, 12)).toEqual({ index: 3, total: 3 });
  });

  it('group_idがnullの単発登録はnullを返す', () => {
    const rows: CountdownGroupRow[] = [{ id: 1, group_id: null }];
    expect(computeCountdownGroupPosition(rows, 1)).toBeNull();
  });

  it('同じgroup_idが自分しかいない(他が削除済み等)場合もnullを返す', () => {
    const rows: CountdownGroupRow[] = [
      { id: 1, group_id: 'g1' },
      { id: 2, group_id: 'g2' },
    ];
    expect(computeCountdownGroupPosition(rows, 1)).toBeNull();
  });

  it('他グループが混在していても対象グループのみで数える', () => {
    const rows: CountdownGroupRow[] = [
      { id: 1, group_id: 'gA' },
      { id: 2, group_id: 'gB' },
      { id: 3, group_id: 'gA' },
      { id: 4, group_id: 'gB' },
    ];
    expect(computeCountdownGroupPosition(rows, 2)).toEqual({ index: 1, total: 2 });
    expect(computeCountdownGroupPosition(rows, 4)).toEqual({ index: 2, total: 2 });
  });

  it('対象idがrowsに存在しない場合はnullを返す', () => {
    const rows: CountdownGroupRow[] = [{ id: 1, group_id: 'g1' }];
    expect(computeCountdownGroupPosition(rows, 999)).toBeNull();
  });
});

describe('filterCountdownEventsByDate', () => {
  const events = [
    { id: 1, label: '9/1の予定A', target_at: '2026-09-01T09:00:00' },
    { id: 2, label: '9/1の予定B', target_at: '2026-09-01T18:30:00' },
    { id: 3, label: '9/2の予定', target_at: '2026-09-02T09:00:00' },
  ];

  it('dateStrがnullなら絞り込まず全件を返す', () => {
    expect(filterCountdownEventsByDate(events, null)).toEqual(events);
  });

  it('指定した日付(ローカル日付)に一致するイベントだけを返す', () => {
    const result = filterCountdownEventsByDate(events, '2026-09-01');
    expect(result.map((e) => e.id)).toEqual([1, 2]);
  });

  it('該当する予定が無い日付なら空配列を返す', () => {
    expect(filterCountdownEventsByDate(events, '2026-09-05')).toEqual([]);
  });

  it('target_atがパース不能な行は一致しないものとして除外する(異常データで全体を壊さない)', () => {
    const broken = [...events, { id: 4, label: '壊れた行', target_at: 'not-a-date' }];
    const result = filterCountdownEventsByDate(broken, '2026-09-01');
    expect(result.map((e) => e.id)).toEqual([1, 2]);
  });
});

// 対象: ログイン時の cf-auth 期限登録と同じ upsert。APIキー発行時は予定名 'PK期限' を渡す。
//
// 故障シナリオ:
//   (1) 有効期限付きなのに INSERT されない
//   (2) 無期限なのに null の target_at で不正行が作られる
//   (3) INSERT失敗を空文字で握りつぶし、呼び出し元が失敗に気づけない
//   (4) 2回発行で行が増え続け、ログイン時の upsert と食い違う
//   (5) 渡した予定名ではなく別の固定ラベルでINSERTしてしまう
function createCountdownUpsertMock(opts?: { throwOnWrite?: boolean }): {
  db: CountdownInsertDb;
  rows: { id: number; user_id: string; label: string; target_at: string }[];
  sqls: string[];
} {
  const rows: { id: number; user_id: string; label: string; target_at: string }[] = [];
  const sqls: string[] = [];
  let nextId = 1;
  const db: CountdownInsertDb = {
    prepare(sql: string) {
      sqls.push(sql);
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes('FROM countdown_events')) {
                const userId = params[0] as string;
                const label = params[1] as string;
                const found = rows.find((row) => row.user_id === userId && row.label === label);
                return (found ? { id: found.id } : null) as T | null;
              }
              return null;
            },
            async run() {
              if (opts?.throwOnWrite) throw new Error('D1 insert failed');
              if (sql.includes('UPDATE countdown_events')) {
                const targetAt = params[0] as string;
                const id = params[1] as number;
                const row = rows.find((item) => item.id === id);
                if (row) row.target_at = targetAt;
                return { success: true };
              }
              if (sql.includes('INSERT INTO countdown_events')) {
                expect(params).toHaveLength(3);
                rows.push({
                  id: nextId++,
                  user_id: params[0] as string,
                  label: params[1] as string,
                  target_at: params[2] as string,
                });
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { db, rows, sqls };
}

describe('upsertCountdownEvent', () => {
  const expiresAt = '2026-10-15T08:00:00.000Z';

  it('有効期限があるときは渡した user_id・予定名・expiresAt で新規INSERTする', async () => {
    const { db, rows } = createCountdownUpsertMock();
    const result = await upsertCountdownEvent(db, {
      userId: 'octocat',
      label: 'PK期限',
      targetAt: expiresAt,
    });
    expect(result).toEqual({ ok: true, registered: true });
    expect(rows).toEqual([
      { id: 1, user_id: 'octocat', label: 'PK期限', target_at: expiresAt },
    ]);
  });

  it('ログイン時と同じ INSERT 文を使い、group_id は SQL の NULL リテラルにする', async () => {
    const { db, sqls } = createCountdownUpsertMock();
    await upsertCountdownEvent(db, {
      userId: 'octocat',
      label: 'PK期限',
      targetAt: expiresAt,
    });
    expect(sqls).toContain(COUNTDOWN_EVENT_INSERT_SQL);
    expect(COUNTDOWN_EVENT_INSERT_SQL).toBe(
      'INSERT INTO countdown_events (user_id, label, target_at, group_id) VALUES (?, ?, ?, NULL)'
    );
  });

  it('ログイン時の upsertCfAuthDeadlineCountdown は upsertCountdownEvent を呼ぶ', () => {
    const src = readFileSync(resolve(__dirname, '../index.ts'), 'utf-8');
    const idx = src.indexOf('async function upsertCfAuthDeadlineCountdown');
    const block = src.slice(idx, idx + 900);
    expect(block).toContain('upsertCountdownEvent(');
    expect(block).toContain('CF_AUTH_DEADLINE_LABEL');
  });

  it('予定名は呼び出し側の文字列をそのまま保存する(専用モードではない)', async () => {
    const { db, rows } = createCountdownUpsertMock();
    await upsertCountdownEvent(db, {
      userId: 'octocat',
      label: '会議',
      targetAt: expiresAt,
    });
    expect(rows[0].label).toBe('会議');
  });

  it('無期限(targetAt=null)のときはINSERTせず skipReason=no_expiry を返す', async () => {
    const { db, rows } = createCountdownUpsertMock();
    const result = await upsertCountdownEvent(db, {
      userId: 'octocat',
      label: 'PK期限',
      targetAt: null,
    });
    expect(result).toEqual({ ok: true, registered: false, skipReason: 'no_expiry' });
    expect(rows).toHaveLength(0);
  });

  it('DB未設定は insert せず errorCode=no_db と空でない詳細を返す', async () => {
    const result = await upsertCountdownEvent(undefined, {
      userId: 'octocat',
      label: 'PK期限',
      targetAt: expiresAt,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('no_db');
    expect(result.detail.length).toBeGreaterThan(0);
  });

  it('書き込み失敗は握りつぶさず errorCode=insert_failed と例外メッセージを返す', async () => {
    const { db, rows } = createCountdownUpsertMock({ throwOnWrite: true });
    const result = await upsertCountdownEvent(db, {
      userId: 'octocat',
      label: 'PK期限',
      targetAt: expiresAt,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('insert_failed');
    expect(result.detail).toBe('D1 insert failed');
    expect(rows).toHaveLength(0);
  });

  it('同じ user_id+予定名なら2回目は INSERT せず target_at だけ更新する(ログイン時と同じ)', async () => {
    const { db, rows, sqls } = createCountdownUpsertMock();
    await upsertCountdownEvent(db, {
      userId: 'octocat',
      label: 'PK期限',
      targetAt: '2026-10-15T00:00:00.000Z',
    });
    await upsertCountdownEvent(db, {
      userId: 'octocat',
      label: 'PK期限',
      targetAt: '2026-12-14T00:00:00.000Z',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].target_at).toBe('2026-12-14T00:00:00.000Z');
    expect(sqls).toContain('SELECT id FROM countdown_events WHERE user_id = ? AND label = ? LIMIT 1');
    expect(sqls).toContain('UPDATE countdown_events SET target_at = ? WHERE id = ?');
  });

  it('予定名が違えば別行になる(PK期限は cf-auth 期限を上書きしない)', async () => {
    const { db, rows } = createCountdownUpsertMock();
    await upsertCountdownEvent(db, {
      userId: 'octocat',
      label: 'cf-auth 期限',
      targetAt: '2026-10-01T00:00:00.000Z',
    });
    await upsertCountdownEvent(db, {
      userId: 'octocat',
      label: 'PK期限',
      targetAt: '2026-10-15T00:00:00.000Z',
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.label).sort()).toEqual(['PK期限', 'cf-auth 期限']);
  });
});

describe('formatCountdownInsertNotice', () => {
  it('登録成功なら渡した予定名を登録した旨を返す', () => {
    const notice = formatCountdownInsertNotice({ ok: true, registered: true }, 'PK期限');
    expect(notice).toContain('PK期限');
    expect(notice).toContain('登録');
  });

  it('無期限スキップなら無期限である旨を返し、失敗とは書かない', () => {
    const notice = formatCountdownInsertNotice({
      ok: true,
      registered: false,
      skipReason: 'no_expiry',
    }, 'PK期限');
    expect(notice).toContain('無期限');
    expect(notice).not.toContain('失敗');
  });

  it('INSERT失敗なら詳細が空にならず、呼び出し元が原因を読める', () => {
    const notice = formatCountdownInsertNotice({
      ok: false,
      errorCode: 'insert_failed',
      detail: 'D1 insert failed',
    }, 'PK期限');
    expect(notice).toContain('失敗');
    expect(notice).toContain('D1 insert failed');
  });
});

