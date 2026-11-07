import { describe, it, expect } from 'vitest';
import { loadInquiryBoard, loadInquiryCase, INQUIRY_CASE_ID_RE, INQUIRY_PHASES } from './museInquiryBoard';

// ユーザー指定(2026-11-07): Museとの協議内容(D1 agent-inquiries)を、本体ワーカーのページでカンバン形式に表示する。
// 列はフェーズ(協議・未解決の論点・提案・採用・完了・不採用)、各列に提案や協議内容のパネルを並べ、パネルから詳細を開く。
type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...p: unknown[]) { params = p; return stmt; },
        async all() {
          calls.push({ sql, params });
          const table = Object.keys(tables).find((name) => new RegExp(`FROM ${name}\\b`).test(sql));
          const rows = table ? tables[table] : [];
          const caseId = params[0];
          return { results: caseId === undefined ? rows : rows.filter((r) => r.case_id === caseId || r.id === caseId) };
        },
      };
      return stmt;
    },
  };
  return { db: db as unknown as D1Database, calls };
}

const CASE = { id: 'bridge-jobs-queue-20261107', goal: 'キューを読む', status: 'open', created_at: '2026-11-07T19:50:00Z', resolved_at: null, entries: 2, last_asked_at: '2026-11-07T20:30:00Z', duration_seconds: 313, open_keys: 1, blocking_open_keys: 0, proposed: 1 };
const TABLES = {
  inquiry_cases: [CASE],
  inquiry_entries: [
    { case_id: CASE.id, seq: 2, clue: '協議する', agent: 'muse', asked_by: 'claude-code', info: '役割を分ける', progress: '合意案', status: 'answered', duration_seconds: 145, created_at: '2026-11-07T20:30:00Z' },
    { case_id: CASE.id, seq: 1, clue: '読み方', agent: 'muse', asked_by: 'claude-code', info: 'SSHで読む', progress: '読めた', status: 'answered', duration_seconds: 168, created_at: '2026-11-07T19:55:00Z' },
  ],
  inquiry_keys: [{ case_id: CASE.id, id: 'k1', kind: 'pitfall', text: '排他が無い', status: 'open', blocking: 0, mutating: 1 }],
  inquiry_proposals: [
    { case_id: CASE.id, id: 'p1', entry_id: CASE.id + '-e2', proposed_by: 'muse', text: 'renameで排他', status: 'proposed', reason: '利用者が決める' },
    { case_id: CASE.id, id: 'p2', entry_id: null, proposed_by: 'muse', text: '採用済み', status: 'adopted', reason: null },
    { case_id: CASE.id, id: 'p3', entry_id: null, proposed_by: 'muse', text: '終わった', status: 'done', reason: null },
    { case_id: CASE.id, id: 'p4', entry_id: null, proposed_by: 'muse', text: '見送り', status: 'rejected', reason: '混合コンテンツに当たらない' },
  ],
};

describe('協議のカンバンのデータ', () => {
  it('フェーズは協議・未解決の論点・提案・採用・完了・不採用の順', () => {
    expect(INQUIRY_PHASES.map((p) => p.key)).toEqual(['inquiry', 'open-keys', 'proposed', 'adopted', 'done', 'rejected']);
  });

  it('各フェーズにパネルを振り分け、ケースの集計(提案数・問い合わせ数など)を返す。回答の全文は読まない', async () => {
    const { db, calls } = fakeDb(TABLES);
    const board = await loadInquiryBoard(db);
    // パネルは型ごとに項目が違うため、テストでは項目を自由に読む
    const phase = (key: string) => board.phases.find((p) => p.key === key)! as unknown as { panels: Array<Record<string, unknown>> };
    expect(phase('inquiry').panels.map((p) => p.type + ':' + p.seq)).toEqual(['entry:2', 'entry:1']);
    expect(phase('inquiry').panels[0]).toMatchObject({ caseId: CASE.id, title: '協議する', summary: '役割を分ける', durationSeconds: 145 });
    expect(phase('open-keys').panels).toEqual([expect.objectContaining({ type: 'key', id: 'k1', kind: 'pitfall', title: '排他が無い', mutating: true })]);
    expect(phase('proposed').panels).toEqual([expect.objectContaining({ type: 'proposal', id: 'p1', title: 'renameで排他', entryId: CASE.id + '-e2' })]);
    expect(phase('adopted').panels.map((p) => p.id)).toEqual(['p2']);
    expect(phase('done').panels.map((p) => p.id)).toEqual(['p3']);
    expect(phase('rejected').panels[0]).toMatchObject({ id: 'p4', reason: '混合コンテンツに当たらない' });
    expect(board.cases[0]).toMatchObject({ id: CASE.id, entries: 2, openKeys: 1, proposed: 1, durationSeconds: 313 });
    expect(calls.some((c) => /\banswer\b/.test(c.sql))).toBe(false);
  });

  it('提案の記録日時と元の会話のID・番号・見出しを返す。回答全文は一覧で取得しない', async () => {
    const { db, calls } = fakeDb({ ...TABLES,
      inquiry_entries: [{ ...TABLES.inquiry_entries[0], id: CASE.id + '-e2' }],
      inquiry_proposals: [{ ...TABLES.inquiry_proposals[0], created_at: '2026-11-08T01:00:00Z' }],
    });
    const board = await loadInquiryBoard(db);
    expect(board.phases.find((p) => p.key === 'proposed')!.panels[0]).toMatchObject({
      createdAt: '2026-11-08T01:00:00Z', sourceEntry: { id: CASE.id + '-e2', seq: 2, title: '協議する' },
    });
    expect(calls.some((c) => /\banswer\b/.test(c.sql))).toBe(false);
  });

  it('ケースの詳細は、問い合わせを順番どおり、回答の全文・キー・提案と一緒に返す。IDはパラメータで渡す', async () => {
    const { db, calls } = fakeDb({
      inquiry_cases: [CASE],
      inquiry_entries: [
        { case_id: CASE.id, seq: 1, clue: 'c1', asked_by: 'claude-code', agent: 'muse', ask_id: 'muse-1', question: 'q1', answer: '<b>a1</b>', info: 'i1', progress: 'p1', status: 'answered', duration_seconds: 168, created_at: '2026-11-07T19:55:00Z' },
      ],
      inquiry_keys: TABLES.inquiry_keys,
      inquiry_proposals: TABLES.inquiry_proposals,
    });
    const detail = await loadInquiryCase(db, CASE.id);
    expect(detail?.case.id).toBe(CASE.id);
    expect(detail?.entries[0]).toMatchObject({ seq: 1, answer: '<b>a1</b>', durationSeconds: 168 });
    expect(detail?.keys[0]).toMatchObject({ kind: 'pitfall', status: 'open', mutating: true, blocking: false });
    expect(detail?.proposals[0]).toMatchObject({ status: 'proposed', entryId: CASE.id + '-e2' });
    expect(calls.every((c) => !c.sql.includes(CASE.id))).toBe(true);
    expect(calls.every((c) => c.params[0] === CASE.id)).toBe(true);
  });

  it('存在しないケースはnull、IDの形式は英数字とハイフンだけを受け付ける', async () => {
    const { db } = fakeDb({ inquiry_cases: [] });
    expect(await loadInquiryCase(db, 'none-20261107')).toBeNull();
    expect(INQUIRY_CASE_ID_RE.test('bridge-jobs-queue-20261107')).toBe(true);
    expect(INQUIRY_CASE_ID_RE.test("x' OR 1=1")).toBe(false);
    expect(INQUIRY_CASE_ID_RE.test('')).toBe(false);
  });
});
