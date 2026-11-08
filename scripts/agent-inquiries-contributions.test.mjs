// D1 agent-inquiriesの記録台帳と、効いたもの・生きなかったものの記録を確かめる。
// SPEC.cloudflare-workers-github-oauth-1.20261108.contribution-evaluation.md(2026-11-08に利用者が承認)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const DIR = new URL('../migrations-agent-inquiries/', import.meta.url);
const FILES = readdirSync(DIR).filter((n) => n.endsWith('.sql')).sort();
const LEDGER = '0011_create_contribution_records.sql';

function apply(db, names) {
  for (const name of names) db.exec(readFileSync(new URL(name, DIR), 'utf8'));
}
function open() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON'); // D1は外部キーを常に強制する
  return db;
}
function seed(db, suffix) {
  db.exec(`INSERT INTO inquiry_cases (id, goal) VALUES ('c${suffix}', '目的${suffix}');
    INSERT INTO inquiry_entries (id, case_id, seq, clue, asked_by, agent, question) VALUES ('e${suffix}', 'c${suffix}', 1, '手がかり${suffix}', 'user', 'muse', '質問');
    INSERT INTO inquiry_keys (id, case_id, kind, text) VALUES ('k${suffix}', 'c${suffix}', 'pitfall', '落とし穴${suffix}');
    INSERT INTO inquiry_proposals (id, case_id, proposed_by, text) VALUES ('p${suffix}', 'c${suffix}', 'codex', '提案${suffix}');
    INSERT INTO inquiry_knowledge (id, scope, text) VALUES ('n${suffix}', 'lib', '知識${suffix}');`);
}
const records = (db) => db.prepare('SELECT id, kind, ref, label, deleted_at FROM inquiry_records ORDER BY id').all().map((r) => ({ ...r }));
function full() {
  const db = open();
  apply(db, FILES);
  seed(db, '1');
  return db;
}
const contribute = (db, source, target, effect, phase = 'decision', by = 'codex') => db.prepare(
  'INSERT INTO inquiry_contributions (source_id, target_id, effect, phase, judged_by) VALUES (?, ?, ?, ?, ?)').run(source, target, effect, phase, by);

test('0011より前からある議題・問い合わせ・論点・提案・知識を台帳に書き込む', () => {
  const db = open();
  apply(db, FILES.filter((n) => n < LEDGER));
  seed(db, '0');
  apply(db, FILES.filter((n) => n >= LEDGER));
  assert.deepEqual(records(db), [
    { id: 'case:c0', kind: 'case', ref: 'c0', label: '目的0', deleted_at: null },
    { id: 'entry:e0', kind: 'entry', ref: 'e0', label: '手がかり0', deleted_at: null },
    { id: 'key:k0', kind: 'key', ref: 'k0', label: '落とし穴0', deleted_at: null },
    { id: 'knowledge:n0', kind: 'knowledge', ref: 'n0', label: '知識0', deleted_at: null },
    { id: 'proposal:p0', kind: 'proposal', ref: 'p0', label: '提案0', deleted_at: null },
  ]);
});

test('新しく作った5種類の記録は、トリガーで台帳に入る', () => {
  const db = full();
  assert.deepEqual(records(db).map((r) => r.id), ['case:c1', 'entry:e1', 'key:k1', 'knowledge:n1', 'proposal:p1']);
});

test('元の記録を消しても台帳の行は残り、deleted_atが付く。議題ごとの連鎖削除でも同じ', () => {
  const db = full();
  contribute(db, 'entry:e1', 'case:c1', 'changed_direction');
  db.exec("DELETE FROM inquiry_knowledge WHERE id = 'n1'");
  assert.match(records(db).find((r) => r.id === 'knowledge:n1').deleted_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  db.exec("DELETE FROM inquiry_cases WHERE id = 'c1'");
  const left = records(db);
  assert.deepEqual(left.map((r) => r.id), ['case:c1', 'entry:e1', 'key:k1', 'knowledge:n1', 'proposal:p1']);
  assert.ok(left.every((r) => r.deleted_at), '連鎖で消えた問い合わせ・論点・提案にもdeleted_atが付く');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiry_contributions').get().n, 1, '効いたものの記録は消えない');
  db.exec("INSERT INTO inquiry_knowledge (id, scope, text) VALUES ('n1', 'lib', '作り直した知識')");
  const again = records(db).find((r) => r.id === 'knowledge:n1');
  assert.equal(again.deleted_at, null, '同じIDで作り直すとdeleted_atを空に戻す');
  assert.equal(again.label, '作り直した知識');
});

test('外部の基準・コミットなど元の表に無い出どころも、台帳に足せば結べる', () => {
  const db = full();
  db.exec("INSERT INTO inquiry_records (id, kind, ref, label) VALUES ('ext:CWE-294', 'ext', 'CWE-294', '再送攻撃')");
  contribute(db, 'ext:CWE-294', 'key:k1', 'prevented_defect', 'trial');
  assert.throws(() => contribute(db, 'ext:CWE-778', 'key:k1', 'prevented_defect', 'trial'), /FOREIGN KEY/);
  assert.throws(() => db.exec("INSERT INTO inquiry_records (id, kind, ref) VALUES (NULL, 'x', 'y')"), /NOT NULL/);
  assert.throws(() => db.exec("INSERT INTO inquiry_records (id, kind, ref) VALUES ('ext:dup', 'ext', 'CWE-294')"), /UNIQUE/);
});

test('効き方は8種類と段だけ。同じ組は1行、段が違えば別、自分自身は不可、使われている台帳の行は物理的に消せない', () => {
  const db = full();
  for (const effect of ['changed_direction', 'avoided_inquiry', 'closed_key', 'prevented_defect', 'avoided_building', 'corrected_premise', 'changed_cost', 'kept_for_later']) {
    contribute(db, 'proposal:p1', 'case:c1', effect);
  }
  assert.throws(() => contribute(db, 'proposal:p1', 'case:c1', 'liked'), /CHECK/);
  assert.throws(() => contribute(db, 'proposal:p1', 'case:c1', 'closed_key', 'someday'), /CHECK/);
  assert.throws(() => contribute(db, 'proposal:p1', 'case:c1', 'closed_key', 'decision', 'user'), /UNIQUE/);
  contribute(db, 'proposal:p1', 'case:c1', 'closed_key', 'trial');
  assert.throws(() => contribute(db, 'case:c1', 'case:c1', 'closed_key'), /CHECK/);
  assert.throws(() => db.exec("DELETE FROM inquiry_records WHERE id = 'proposal:p1'"), /FOREIGN KEY/);
});

test('エージェントが付けた効き方は仮で、利用者が確かめるとconfirmed_byとconfirmed_atが入る', () => {
  const db = full();
  contribute(db, 'entry:e1', 'case:c1', 'corrected_premise');
  const row = db.prepare('SELECT id, judged_by, confirmed_by, confirmed_at FROM inquiry_contributions').get();
  assert.equal(row.judged_by, 'codex');
  assert.equal(row.confirmed_by, null);
  assert.equal(row.confirmed_at, null);
  db.prepare("UPDATE inquiry_contributions SET confirmed_by = 'user', confirmed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(row.id);
  assert.equal(db.prepare('SELECT confirmed_by FROM inquiry_contributions').get().confirmed_by, 'user');
  assert.throws(() => db.prepare("UPDATE inquiry_contributions SET confirmed_by = 'user', confirmed_at = NULL WHERE id = ?").run(row.id), /CHECK/);
});

test('生きなかったものは別の表で、結果の種類が決まっていて、同じ組は1行', () => {
  const db = full();
  db.exec("INSERT INTO inquiry_records (id, kind, ref) VALUES ('rule:lib/NOTICE#pkill', 'rule', 'lib/NOTICE#pkill')");
  db.prepare("INSERT INTO inquiry_unused (source_id, target_id, consequence, judged_by) VALUES ('rule:lib/NOTICE#pkill', 'case:c1', 'failure', 'claude-code')").run();
  assert.throws(() => db.prepare("INSERT INTO inquiry_unused (source_id, target_id, consequence, judged_by) VALUES ('rule:lib/NOTICE#pkill', 'case:c1', 'rework', 'user')").run(), /UNIQUE/);
  assert.throws(() => db.prepare("INSERT INTO inquiry_unused (source_id, target_id, consequence, judged_by) VALUES ('knowledge:n1', 'case:c1', 'oops', 'user')").run(), /CHECK/);
});
