import { describe, it, expect } from 'vitest';
import { loadInquiryBoard, loadInquiryCase, decideInquiryProposal, INQUIRY_CASE_ID_RE, INQUIRY_PHASES, INQUIRY_STAGES } from './museInquiryBoard';

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

const CASE = { id: 'bridge-jobs-queue-20261107', goal: 'キューを読む', status: 'open', stage: 'plan', created_at: '2026-11-07T19:50:00Z', resolved_at: null, entries: 2, last_asked_at: '2026-11-07T20:30:00Z', duration_seconds: 313, open_keys: 1, blocking_open_keys: 0, proposed: 1 };
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
  // ユーザー指定(2026-11-08午後): 完了のカードが左の列に残らないよう、回答済み・失敗の問い合わせは「完了」の列に置く。
  // 午前に足した専用の列(回答済み・失敗の問い合わせ)はやめた。カードの「完了」の印と列を一致させる。
  it('フェーズは協議・未解決の論点・提案・採用・完了・不採用の順で、回答済みの専用の列は無い', () => {
    expect(INQUIRY_PHASES.map((p) => p.key)).toEqual(['inquiry', 'open-keys', 'proposed', 'adopted', 'done', 'rejected']);
  });

  it('各フェーズにパネルを振り分け、ケースの集計(提案数・問い合わせ数など)を返す。回答の全文は読まない', async () => {
    const { db, calls } = fakeDb(TABLES);
    const board = await loadInquiryBoard(db);
    // パネルは型ごとに項目が違うため、テストでは項目を自由に読む
    const phase = (key: string) => board.phases.find((p) => p.key === key)! as unknown as { panels: Array<Record<string, unknown>> };
    // ユーザー指定(2026-11-08): カードは今の状態に合った列に置く。回答済みの問い合わせは協議の列に残さず、完了の列へ。
    expect(phase('inquiry').panels).toEqual([]);
    expect(phase('done').panels.filter((p) => p.type === 'entry').map((p) => p.type + ':' + p.seq)).toEqual(['entry:2', 'entry:1']);
    expect(phase('done').panels.find((p) => p.type === 'entry')).toMatchObject({ caseId: CASE.id, title: '協議する', summary: '役割を分ける', durationSeconds: 145 });
    expect(phase('open-keys').panels).toEqual([expect.objectContaining({ type: 'key', id: 'k1', kind: 'pitfall', title: '排他が無い', mutating: true })]);
    expect(phase('proposed').panels).toEqual([expect.objectContaining({ type: 'proposal', id: 'p1', title: 'renameで排他', entryId: CASE.id + '-e2' })]);
    expect(phase('adopted').panels.map((p) => p.id)).toEqual(['p2']);
    expect(phase('done').panels.filter((p) => p.type === 'proposal').map((p) => p.id)).toEqual(['p3']);
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

  // ユーザー指定(2026-11-08): 構想段階の議題がどう肉付けされたかを追える「経緯」の表示のため、論点を開いた・閉じた問い合わせと、提案の記録日時も返す。
  it('ケースの詳細は、論点を開いた・閉じた問い合わせのIDと、提案の記録日時も返す', async () => {
    const { db } = fakeDb({
      inquiry_cases: [CASE],
      inquiry_entries: TABLES.inquiry_entries,
      inquiry_keys: [{ case_id: CASE.id, id: 'k2', kind: 'unknown', text: '未確認', status: 'closed', blocking: 0, mutating: 0, opened_by_entry_id: CASE.id + '-e1', closed_by_entry_id: CASE.id + '-e2' }],
      inquiry_proposals: [{ case_id: CASE.id, id: 'p2', entry_id: CASE.id + '-e2', proposed_by: 'muse', text: '案', status: 'adopted', reason: null, created_at: '2026-11-07T20:31:00Z' }],
    });
    const detail = await loadInquiryCase(db, CASE.id);
    expect(detail?.keys[0]).toMatchObject({ id: 'k2', openedByEntryId: CASE.id + '-e1', closedByEntryId: CASE.id + '-e2' });
    expect(detail?.proposals[0]).toMatchObject({ id: 'p2', entryId: CASE.id + '-e2', createdAt: '2026-11-07T20:31:00Z' });
  });

  it('問い合わせは、回答待ち・未送信なら協議の列、回答済み・失敗なら完了の列に置く', async () => {
    const e = (seq: number, status: string) => ({ ...TABLES.inquiry_entries[0], id: 'e' + seq, seq, status, created_at: '2026-11-08T00:0' + seq + ':00Z' });
    const { db } = fakeDb({ ...TABLES, inquiry_entries: [e(1, 'sent'), e(2, 'planned'), e(3, 'answered'), e(4, 'failed')] });
    const board = await loadInquiryBoard(db);
    const seqs = (key: string) => (board.phases.find((p) => p.key === key)!.panels as Array<Record<string, unknown>>).filter((p) => p.type === 'entry').map((p) => p.seq);
    expect(seqs('inquiry')).toEqual([1, 2]);
    expect(seqs('done')).toEqual([3, 4]);
    expect(board.phases.some((p) => (p.key as string) === 'answered')).toBe(false);
  });

  // ユーザー指定(2026-11-08): 議題を段階(構想・計画・実装・試験運用)で区別する。状態(open・resolved・abandoned)とは別の列。
  it('議題の段階は構想・計画・実装・試験運用の順で、ケースのstageを読む。未知の値や未設定はnull', async () => {
    expect(INQUIRY_STAGES).toEqual(['concept', 'plan', 'implementation', 'trial']);
    const { db, calls } = fakeDb({ ...TABLES, inquiry_cases: [CASE, { ...CASE, id: 'x-20261108', stage: 'bogus' }, { ...CASE, id: 'y-20261108', stage: null }] });
    const board = await loadInquiryBoard(db);
    expect(board.cases.map((c) => c.stage)).toEqual(['plan', null, null]);
    expect(calls.some((c) => /\bc\.stage\b/.test(c.sql))).toBe(true);
  });

  it('存在しないケースはnull、IDの形式は英数字とハイフンだけを受け付ける', async () => {
    const { db } = fakeDb({ inquiry_cases: [] });
    expect(await loadInquiryCase(db, 'none-20261107')).toBeNull();
    expect(INQUIRY_CASE_ID_RE.test('bridge-jobs-queue-20261107')).toBe(true);
    expect(INQUIRY_CASE_ID_RE.test("x' OR 1=1")).toBe(false);
    expect(INQUIRY_CASE_ID_RE.test('')).toBe(false);
  });
});

// ユーザー指定(2026-11-08): 採否待ちの提案のモーダルから、その場で採用・不採用を記録する。採用は判断の記録だけで、実行は始めない。
function decisionDb(proposal: Row | null, changes = 1) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      let params: unknown[] = [];
      const stmt = {
        bind(...p: unknown[]) { params = p; return stmt; },
        async first() { calls.push({ sql, params }); return proposal; },
        async run() { calls.push({ sql, params }); return { meta: { changes } }; },
      };
      return stmt;
    },
  };
  return { db: db as unknown as D1Database, calls };
}

describe('提案の採否の記録', () => {
  const NOW = new Date('2026-11-08T02:00:00Z');
  it('採否待ちの提案だけを、条件付きのUPDATE1文で採用にし、誰がいつ画面で決めたかを理由の先頭に足す', async () => {
    const { db, calls } = decisionDb({ id: 'p1', status: 'proposed', reason: '利用者が決める' });
    const result = await decideInquiryProposal(db, 'p1', 'adopted', 'これで進める', 'okiraku', NOW);
    expect(result).toEqual({ ok: true, status: 'adopted' });
    const update = calls.find((c) => /^UPDATE inquiry_proposals/.test(c.sql))!;
    expect(update.sql).toMatch(/WHERE id = \?3 AND status = 'proposed'/);
    expect(update.params).toEqual(['adopted', '［2026-11-08T02:00:00Z okirakuが/muse-inquiriesで採用］ これで進める / 以前の理由: 利用者が決める', 'p1']);
  });
  it('不採用も記録でき、メモと以前の理由が無ければ見出しだけを書く', async () => {
    const { db, calls } = decisionDb({ id: 'p2', status: 'proposed', reason: null });
    expect(await decideInquiryProposal(db, 'p2', 'rejected', '  ', 'okiraku', NOW)).toEqual({ ok: true, status: 'rejected' });
    expect(calls.find((c) => /^UPDATE/.test(c.sql))!.params[1]).toBe('［2026-11-08T02:00:00Z okirakuが/muse-inquiriesで不採用］');
  });
  it('無い提案はnot_found、採否待ちでない提案や更新の競合はnot_pending、不正な入力はinvalidで、書き込まない', async () => {
    expect(await decideInquiryProposal(decisionDb(null).db, 'none', 'adopted', '', 'u', NOW)).toMatchObject({ ok: false, errorCode: 'not_found' });
    const done = decisionDb({ id: 'p3', status: 'done', reason: null });
    expect(await decideInquiryProposal(done.db, 'p3', 'adopted', '', 'u', NOW)).toMatchObject({ ok: false, errorCode: 'not_pending' });
    expect(done.calls.some((c) => /^UPDATE/.test(c.sql))).toBe(false);
    expect(await decideInquiryProposal(decisionDb({ id: 'p4', status: 'proposed', reason: null }, 0).db, 'p4', 'adopted', '', 'u', NOW)).toMatchObject({ ok: false, errorCode: 'not_pending' });
    const bad = decisionDb({ id: 'p5', status: 'proposed', reason: null });
    expect(await decideInquiryProposal(bad.db, 'p5', 'done' as never, '', 'u', NOW)).toMatchObject({ ok: false, errorCode: 'invalid' });
    expect(await decideInquiryProposal(bad.db, "x' OR 1=1", 'adopted', '', 'u', NOW)).toMatchObject({ ok: false, errorCode: 'invalid' });
    expect(await decideInquiryProposal(bad.db, 'p5', 'adopted', 'あ'.repeat(1001), 'u', NOW)).toMatchObject({ ok: false, errorCode: 'invalid' });
    expect(bad.calls).toEqual([]);
  });
});
