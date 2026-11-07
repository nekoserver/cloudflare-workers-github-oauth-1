/**
 * Museとの協議(D1 agent-inquiries)をカンバン形式で表示するためのデータ。ユーザー指定(2026-11-07)。
 *
 * 列はフェーズ(協議・未解決の論点・提案・採用・完了・不採用)で、各列に問い合わせ・キー・提案のパネルを並べる。
 * 一覧では回答の全文を読まず(重いため)、パネルを開いたときにケースの詳細を読む。スキーマはmigrations-agent-inquiries/、
 * 記録の手順はSPEC.cloudflare-workers-github-oauth-1.20261107.muse-inquiry-recording.md。
 */

export type InquiryCaseStatus = 'open' | 'resolved' | 'abandoned';
export const INQUIRY_COLUMNS: InquiryCaseStatus[] = ['open', 'resolved', 'abandoned'];
/** ケースIDは`<話題>-<YYYYMMDD>`。英数字とハイフンだけを受け付ける。 */
export const INQUIRY_CASE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,127}$/;

export interface InquiryCard {
  id: string;
  goal: string;
  status: InquiryCaseStatus;
  createdAt: string;
  resolvedAt: string | null;
  entries: number;
  lastAskedAt: string | null;
  durationSeconds: number;
  openKeys: number;
  blockingOpenKeys: number;
  proposed: number;
}

const CARD_SQL = `SELECT c.id, c.goal, c.status, c.created_at, c.resolved_at,
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
    createdAt: str(row.created_at), resolvedAt: strOrNull(row.resolved_at),
    entries: num(row.entries), lastAskedAt: strOrNull(row.last_asked_at), durationSeconds: num(row.duration_seconds),
    openKeys: num(row.open_keys), blockingOpenKeys: num(row.blocking_open_keys), proposed: num(row.proposed),
  };
}

/** カンバンの列(フェーズ)。協議→未解決の論点→提案→採用→完了、と、見送った提案。 */
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
  | { type: 'proposal'; caseId: string; id: string; title: string; status: string; reason: string | null; proposedBy: string; entryId: string | null };

const PROPOSAL_PHASE: Record<string, InquiryPhaseKey> = { proposed: 'proposed', adopted: 'adopted', done: 'done', rejected: 'rejected' };

export async function loadInquiryBoard(db: D1Database): Promise<{ cases: InquiryCard[]; phases: Array<{ key: InquiryPhaseKey; label: string; panels: InquiryPanel[] }> }> {
  // 一覧では回答の全文(answer)を読まない。パネルを開いたときにloadInquiryCaseで読む。
  const [{ results: caseRows }, { results: entries }, { results: keys }, { results: proposals }] = await Promise.all([
    db.prepare(`${CARD_SQL} ORDER BY COALESCE((SELECT MAX(e.created_at) FROM inquiry_entries e WHERE e.case_id = c.id), c.created_at) DESC`).all<Row>(),
    db.prepare("SELECT case_id, seq, clue, agent, asked_by, info, progress, status, duration_seconds, created_at FROM inquiry_entries WHERE status != 'withdrawn' ORDER BY created_at DESC, seq DESC").all<Row>(),
    db.prepare("SELECT case_id, id, kind, text, status, blocking, mutating FROM inquiry_keys WHERE status = 'open' ORDER BY blocking DESC, created_at").all<Row>(),
    db.prepare('SELECT case_id, id, entry_id, proposed_by, text, status, reason FROM inquiry_proposals ORDER BY created_at DESC, id').all<Row>(),
  ]);
  const panels: Record<InquiryPhaseKey, InquiryPanel[]> = { inquiry: [], 'open-keys': [], proposed: [], adopted: [], done: [], rejected: [] };
  for (const e of entries ?? []) {
    panels.inquiry.push({
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
    panels[phase].push({ type: 'proposal', caseId: str(p.case_id), id: str(p.id), title: str(p.text), status: str(p.status), reason: strOrNull(p.reason), proposedBy: str(p.proposed_by), entryId: strOrNull(p.entry_id) });
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
    db.prepare('SELECT id, kind, text, status, blocking, mutating FROM inquiry_keys WHERE case_id = ? ORDER BY created_at, id').bind(caseId).all<Row>(),
    db.prepare('SELECT id, entry_id, proposed_by, text, status, reason FROM inquiry_proposals WHERE case_id = ? ORDER BY created_at, id').bind(caseId).all<Row>(),
  ]);
  return {
    case: toCard(caseRows[0]),
    entries: (entries ?? []).map((e) => ({
      id: str(e.id), seq: num(e.seq), clue: str(e.clue), askedBy: str(e.asked_by), agent: str(e.agent), askId: strOrNull(e.ask_id),
      question: str(e.question), answer: str(e.answer), info: str(e.info), progress: str(e.progress),
      status: str(e.status), error: strOrNull(e.error), durationSeconds: e.duration_seconds === null || e.duration_seconds === undefined ? null : num(e.duration_seconds),
      createdAt: str(e.created_at),
    })),
    keys: (keys ?? []).map((k) => ({ id: str(k.id), kind: str(k.kind), text: str(k.text), status: str(k.status), blocking: num(k.blocking) === 1, mutating: num(k.mutating) === 1 })),
    proposals: (proposals ?? []).map((p) => ({ id: str(p.id), proposedBy: str(p.proposed_by), text: str(p.text), status: str(p.status), reason: strOrNull(p.reason), entryId: strOrNull(p.entry_id) })),
  };
}
