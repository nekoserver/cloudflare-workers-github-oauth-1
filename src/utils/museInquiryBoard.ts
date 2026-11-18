/**
 * Museとの協議(D1 agent-inquiries)をカンバン形式で表示するためのデータ。ユーザー指定(2026-11-07)。
 *
 * 列はフェーズ(協議・回答済みの問い合わせ・未解決の論点・提案・採用・完了・不採用)で、各列に問い合わせ・キー・提案のパネルを並べる。
 * 一覧では回答の全文を読まず(重いため)、パネルを開いたときにケースの詳細を読む。スキーマはmigrations-agent-inquiries/、
 * 記録の手順はSPEC.cloudflare-workers-github-oauth-1.20261107.muse-inquiry-recording.md。
 */

export type InquiryCaseStatus = 'open' | 'resolved' | 'abandoned';
export const INQUIRY_COLUMNS: InquiryCaseStatus[] = ['open', 'resolved', 'abandoned'];
/** 議題の段階。構想(具体案に乏しい)・計画(一部策定済みや策定中)・実装・試験運用(レビュー待ち)。状態とは別の列。ユーザー指定(2026-11-08)。 */
export type InquiryCaseStage = 'concept' | 'plan' | 'implementation' | 'trial';
export const INQUIRY_STAGES: InquiryCaseStage[] = ['concept', 'plan', 'implementation', 'trial'];
/** ケースIDは`<話題>-<YYYYMMDD>`。英数字とハイフンだけを受け付ける。 */
export const INQUIRY_CASE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/;

export interface InquiryCard {
  id: string;
  goal: string;
  status: InquiryCaseStatus;
  /** 未設定や未知の値はnull。 */
  stage: InquiryCaseStage | null;
  createdAt: string;
  resolvedAt: string | null;
  entries: number;
  lastAskedAt: string | null;
  durationSeconds: number;
  openKeys: number;
  blockingOpenKeys: number;
  proposed: number;
}

const CARD_SQL = `SELECT c.id, c.goal, c.status, c.stage, c.created_at, c.resolved_at,
  (SELECT COUNT(*) FROM inquiry_entries e WHERE e.case_id = c.id AND e.status != 'withdrawn') AS entries,
  (SELECT MAX(e.created_at) FROM inquiry_entries e WHERE e.case_id = c.id) AS last_asked_at,
  (SELECT COALESCE(SUM(e.duration_seconds), 0) FROM inquiry_entries e WHERE e.case_id = c.id) AS duration_seconds,
  (SELECT COUNT(*) FROM inquiry_keys k WHERE k.case_id = c.id AND k.status = 'open') AS open_keys,
  (SELECT COUNT(*) FROM inquiry_keys k WHERE k.case_id = c.id AND k.status = 'open' AND k.blocking = 1) AS blocking_open_keys,
  (SELECT COUNT(*) FROM inquiry_proposals p WHERE p.case_id = c.id AND p.status = 'proposed') AS proposed
FROM inquiry_cases c`;

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const strOrNull = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

function toCard(row: Row): InquiryCard {
  const status = INQUIRY_COLUMNS.includes(row.status as InquiryCaseStatus) ? (row.status as InquiryCaseStatus) : 'open';
  return {
    id: str(row.id), goal: str(row.goal), status,
    stage: INQUIRY_STAGES.includes(row.stage as InquiryCaseStage) ? (row.stage as InquiryCaseStage) : null,
    createdAt: str(row.created_at), resolvedAt: strOrNull(row.resolved_at),
    entries: num(row.entries), lastAskedAt: strOrNull(row.last_asked_at), durationSeconds: num(row.duration_seconds),
    openKeys: num(row.open_keys), blockingOpenKeys: num(row.blocking_open_keys), proposed: num(row.proposed),
  };
}

/** カンバンの列(フェーズ)。協議→未解決の論点→提案→採用→完了、と、見送った提案。回答済み・失敗の問い合わせは完了の列(ユーザー指定、2026-11-08午後)。 */
export const INQUIRY_PHASES = [
  { key: 'inquiry', label: '協議（問い合わせ）' },
  { key: 'open-keys', label: '未解決の論点' },
  { key: 'proposed', label: '提案（採否待ち）' },
  { key: 'adopted', label: '採用・実施中' },
  { key: 'done', label: '完了' },
  { key: 'rejected', label: '不採用' },
] as const;
export type InquiryPhaseKey = typeof INQUIRY_PHASES[number]['key'];

export type InquiryPanel =
  | { type: 'entry'; caseId: string; seq: number; title: string; summary: string; status: string; durationSeconds: number | null; createdAt: string; agent: string }
  | { type: 'key'; caseId: string; id: string; kind: string; title: string; blocking: boolean; mutating: boolean }
  | { type: 'proposal'; caseId: string; id: string; title: string; status: string; reason: string | null; proposedBy: string; entryId: string | null; createdAt: string; sourceEntry: { id: string; seq: number; title: string } | null };

/** 終わった問い合わせの状態。ページのフィルタ(panelFilterStatus)の「完了」と同じ。 */
const ENTRY_DONE_STATUSES = ['answered', 'failed', 'withdrawn'];
const PROPOSAL_PHASE: Record<string, InquiryPhaseKey> = { proposed: 'proposed', adopted: 'adopted', done: 'done', rejected: 'rejected' };

export async function loadInquiryBoard(db: D1Database): Promise<{ cases: InquiryCard[]; phases: Array<{ key: InquiryPhaseKey; label: string; panels: InquiryPanel[] }> }> {
  // 一覧では回答の全文(answer)を読まない。パネルを開いたときにloadInquiryCaseで読む。
  const [{ results: caseRows }, { results: entries }, { results: keys }, { results: proposals }] = await Promise.all([
    db.prepare(`${CARD_SQL} ORDER BY COALESCE((SELECT MAX(e.created_at) FROM inquiry_entries e WHERE e.case_id = c.id), c.created_at) DESC`).all<Row>(),
    db.prepare("SELECT id, case_id, seq, clue, agent, asked_by, info, progress, status, duration_seconds, created_at FROM inquiry_entries WHERE status != 'withdrawn' ORDER BY created_at DESC, seq DESC").all<Row>(),
    db.prepare("SELECT case_id, id, kind, text, status, blocking, mutating FROM inquiry_keys WHERE status = 'open' ORDER BY blocking DESC, created_at").all<Row>(),
    db.prepare('SELECT case_id, id, entry_id, proposed_by, text, status, reason, created_at FROM inquiry_proposals ORDER BY created_at DESC, id').all<Row>(),
  ]);
  const panels: Record<InquiryPhaseKey, InquiryPanel[]> = { inquiry: [], 'open-keys': [], proposed: [], adopted: [], done: [], rejected: [] };
  const entriesById = new Map((entries ?? []).filter((e) => e.id).map((e) => [str(e.id), e]));
  for (const e of entries ?? []) {
    // カードは今の状態に合った列に置く(ユーザー指定、2026-11-08)。回答済み・失敗は、カードの「完了」の印と同じ完了の列へ。
    panels[ENTRY_DONE_STATUSES.includes(str(e.status)) ? 'done' : 'inquiry'].push({
      type: 'entry', caseId: str(e.case_id), seq: num(e.seq), title: str(e.clue), summary: str(e.info), status: str(e.status),
      durationSeconds: e.duration_seconds === null || e.duration_seconds === undefined ? null : num(e.duration_seconds), createdAt: str(e.created_at), agent: str(e.agent),
    });
  }
  for (const k of keys ?? []) {
    if (str(k.status) !== 'open') continue;
    panels['open-keys'].push({ type: 'key', caseId: str(k.case_id), id: str(k.id), kind: str(k.kind), title: str(k.text), blocking: num(k.blocking) === 1, mutating: num(k.mutating) === 1 });
  }
  for (const p of proposals ?? []) {
    const phase = PROPOSAL_PHASE[str(p.status)];
    if (!phase) continue;
    const entry = entriesById.get(str(p.entry_id));
    panels[phase].push({ type: 'proposal', caseId: str(p.case_id), id: str(p.id), title: str(p.text), status: str(p.status), reason: strOrNull(p.reason), proposedBy: str(p.proposed_by), entryId: strOrNull(p.entry_id), createdAt: str(p.created_at),
      sourceEntry: entry && entry.case_id === p.case_id ? { id: str(entry.id), seq: num(entry.seq), title: str(entry.clue) } : null,
    });
  }
  return {
    cases: (caseRows ?? []).map(toCard),
    phases: INQUIRY_PHASES.map((phase) => ({ key: phase.key, label: phase.label, panels: panels[phase.key] })),
  };
}

export async function loadInquiryCase(db: D1Database, caseId: string) {
  const { results: caseRows } = await db.prepare(`${CARD_SQL} WHERE c.id = ?`).bind(caseId).all<Row>();
  if (!caseRows?.length) return null;
  const [{ results: entries }, { results: keys }, { results: proposals }] = await Promise.all([
    db.prepare('SELECT id, seq, clue, asked_by, agent, ask_id, question, answer, info, progress, status, error, duration_seconds, created_at FROM inquiry_entries WHERE case_id = ? ORDER BY seq').bind(caseId).all<Row>(),
    db.prepare('SELECT id, kind, text, status, blocking, mutating, opened_by_entry_id, closed_by_entry_id FROM inquiry_keys WHERE case_id = ? ORDER BY created_at, id').bind(caseId).all<Row>(),
    db.prepare('SELECT id, entry_id, proposed_by, text, status, reason, created_at FROM inquiry_proposals WHERE case_id = ? ORDER BY created_at, id').bind(caseId).all<Row>(),
  ]);
  return {
    case: toCard(caseRows[0]),
    entries: (entries ?? []).map((e) => ({
      id: str(e.id), seq: num(e.seq), clue: str(e.clue), askedBy: str(e.asked_by), agent: str(e.agent), askId: strOrNull(e.ask_id),
      question: str(e.question), answer: str(e.answer), info: str(e.info), progress: str(e.progress),
      status: str(e.status), error: strOrNull(e.error), durationSeconds: e.duration_seconds === null || e.duration_seconds === undefined ? null : num(e.duration_seconds),
      createdAt: str(e.created_at),
    })),
    keys: (keys ?? []).map((k) => ({ id: str(k.id), kind: str(k.kind), text: str(k.text), status: str(k.status), blocking: num(k.blocking) === 1, mutating: num(k.mutating) === 1,
      openedByEntryId: strOrNull(k.opened_by_entry_id), closedByEntryId: strOrNull(k.closed_by_entry_id) })),
    proposals: (proposals ?? []).map((p) => ({ id: str(p.id), proposedBy: str(p.proposed_by), text: str(p.text), status: str(p.status), reason: strOrNull(p.reason), entryId: strOrNull(p.entry_id), createdAt: strOrNull(p.created_at) })),
  };
}

/** 提案の採否。採用は判断の記録だけで、実行は始めない(ユーザー指定、2026-11-08)。 */
export type InquiryProposalDecision = 'adopted' | 'rejected';
export type InquiryDecisionResult =
  | { ok: true; status: InquiryProposalDecision }
  | { ok: false; errorCode: 'invalid' | 'not_found' | 'not_pending'; detail: string };
const DECISION_LABELS: Record<InquiryProposalDecision, string> = { adopted: '採用', rejected: '不採用' };
export const INQUIRY_DECISION_NOTE_MAX = 1000;

/**
 * 採否待ち(proposed)の提案を採用か不採用にする。条件付きのUPDATE1文で、ほかの者が先に決めていたら書かない。
 * 誰がいつ画面で決めたかを理由の先頭に足し、以前の理由は後ろに残す。
 */
export async function decideInquiryProposal(
  db: D1Database, proposalId: string, decision: InquiryProposalDecision, note: string, actor: string, now: Date = new Date(),
): Promise<InquiryDecisionResult> {
  if (decision !== 'adopted' && decision !== 'rejected') return { ok: false, errorCode: 'invalid', detail: '採否はadoptedかrejectedです' };
  if (!INQUIRY_CASE_ID_RE.test(proposalId)) return { ok: false, errorCode: 'invalid', detail: '提案のIDが正しくありません' };
  const memo = String(note ?? '').trim();
  if (memo.length > INQUIRY_DECISION_NOTE_MAX) return { ok: false, errorCode: 'invalid', detail: `メモは${INQUIRY_DECISION_NOTE_MAX}文字までです` };
  const row = await db.prepare('SELECT id, status, reason FROM inquiry_proposals WHERE id = ?1').bind(proposalId).first<Row>();
  if (!row) return { ok: false, errorCode: 'not_found', detail: '提案が見つかりません' };
  if (str(row.status) !== 'proposed') return { ok: false, errorCode: 'not_pending', detail: 'この提案はもう採否待ちではありません' };
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const previous = strOrNull(row.reason);
  const reason = `［${stamp} ${actor || '利用者'}が/muse-inquiriesで${DECISION_LABELS[decision]}］` + (memo ? ` ${memo}` : '') + (previous ? ` / 以前の理由: ${previous}` : '');
  const result = await db.prepare("UPDATE inquiry_proposals SET status = ?1, reason = ?2 WHERE id = ?3 AND status = 'proposed'").bind(decision, reason, proposalId).run();
  if (!result.meta || result.meta.changes !== 1) return { ok: false, errorCode: 'not_pending', detail: 'この提案はもう採否待ちではありません' };
  return { ok: true, status: decision };
}
