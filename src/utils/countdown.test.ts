import { describe, it, expect } from 'vitest';
import {
  computeCfAuthDeadlineTargetAt,
  CF_AUTH_DEADLINE_LABEL,
  CF_AUTH_SESSION_TTL_MS,
  API_KEY_DEADLINE_LABEL,
  insertApiKeyDeadlineCountdown,
  formatApiKeyDeadlineCountdownNotice,
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

// 対象: APIキー発行時に /countdown へ「Key期限」を新規登録する処理。
//
// 故障シナリオ:
//   (1) 有効期限付きキーなのに countdown_events へINSERTされない
//   (2) 無期限キーなのに null の target_at で不正行が作られる
//   (3) INSERT失敗を空文字で握りつぶし、呼び出し元が失敗に気づけない
//   (4) 2回発行しても既存行を上書きしてしまい、先に発行したキーの期限が消える
function createCountdownInsertMock(opts?: { throwOnInsert?: boolean }): {
  db: CountdownInsertDb;
  inserts: { user_id: string; label: string; target_at: string; group_id: unknown }[];
} {
  const inserts: { user_id: string; label: string; target_at: string; group_id: unknown }[] = [];
  const db: CountdownInsertDb = {
    prepare(_sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async run() {
              if (opts?.throwOnInsert) throw new Error('D1 insert failed');
              inserts.push({
                user_id: params[0] as string,
                label: params[1] as string,
                target_at: params[2] as string,
                group_id: params[3],
              });
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { db, inserts };
}

describe('API_KEY_DEADLINE_LABEL', () => {
  it('固定ラベルは「Key期限」', () => {
    expect(API_KEY_DEADLINE_LABEL).toBe('Key期限');
  });
});

describe('insertApiKeyDeadlineCountdown', () => {
  const expiresAt = '2026-10-15T08:00:00.000Z';

  it('有効期限があるときは user_id・Key期限・expiresAt で新規INSERTする', async () => {
    const { db, inserts } = createCountdownInsertMock();
    const result = await insertApiKeyDeadlineCountdown(db, 'octocat', expiresAt);
    expect(result).toEqual({ ok: true, registered: true });
    expect(inserts).toEqual([
      { user_id: 'octocat', label: 'Key期限', target_at: expiresAt, group_id: null },
    ]);
  });

  it('無期限(expiresAt=null)のときはINSERTせず skipReason=no_expiry を返す', async () => {
    const { db, inserts } = createCountdownInsertMock();
    const result = await insertApiKeyDeadlineCountdown(db, 'octocat', null);
    expect(result).toEqual({ ok: true, registered: false, skipReason: 'no_expiry' });
    expect(inserts).toHaveLength(0);
  });

  it('DB未設定は insert せず errorCode=no_db と空でない詳細を返す', async () => {
    const result = await insertApiKeyDeadlineCountdown(undefined, 'octocat', expiresAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('no_db');
    expect(result.detail.length).toBeGreaterThan(0);
  });

  it('INSERT失敗は握りつぶさず errorCode=insert_failed と例外メッセージを返す', async () => {
    const { db, inserts } = createCountdownInsertMock({ throwOnInsert: true });
    const result = await insertApiKeyDeadlineCountdown(db, 'octocat', expiresAt);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('insert_failed');
    expect(result.detail).toBe('D1 insert failed');
    expect(inserts).toHaveLength(0);
  });

  it('2回発行したら2行INSERTする(既存の Key期限 を上書きしない)', async () => {
    const { db, inserts } = createCountdownInsertMock();
    await insertApiKeyDeadlineCountdown(db, 'octocat', '2026-10-15T00:00:00.000Z');
    await insertApiKeyDeadlineCountdown(db, 'octocat', '2026-12-14T00:00:00.000Z');
    expect(inserts).toHaveLength(2);
    expect(inserts.map((row) => row.target_at)).toEqual([
      '2026-10-15T00:00:00.000Z',
      '2026-12-14T00:00:00.000Z',
    ]);
  });
});

describe('formatApiKeyDeadlineCountdownNotice', () => {
  it('登録成功なら Key期限 を登録した旨を返す', () => {
    const notice = formatApiKeyDeadlineCountdownNotice({ ok: true, registered: true });
    expect(notice).toContain('Key期限');
    expect(notice).toContain('登録');
  });

  it('無期限スキップなら無期限である旨を返し、失敗とは書かない', () => {
    const notice = formatApiKeyDeadlineCountdownNotice({
      ok: true,
      registered: false,
      skipReason: 'no_expiry',
    });
    expect(notice).toContain('無期限');
    expect(notice).not.toContain('失敗');
  });

  it('INSERT失敗なら詳細が空にならず、呼び出し元が原因を読める', () => {
    const notice = formatApiKeyDeadlineCountdownNotice({
      ok: false,
      errorCode: 'insert_failed',
      detail: 'D1 insert failed',
    });
    expect(notice).toContain('失敗');
    expect(notice).toContain('D1 insert failed');
  });
});
