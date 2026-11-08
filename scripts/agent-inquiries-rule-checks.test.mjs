// D1 agent-inquiriesの、ルールへの適合の点検と、見つかった箇所の状態・直した件数を確かめる。
// SPEC.cloudflare-workers-github-oauth-1.20261108.contribution-evaluation.md 8章(提案ce-p5、2026-11-08に利用者が採用)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const DIR = new URL('../migrations-agent-inquiries/', import.meta.url);
const RULE = 'rule:cloudflare-workers-github-oauth-1/CLAUDE.md#26';

function migrated() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON'); // D1は外部キーを常に強制する
  for (const name of readdirSync(DIR).filter((n) => n.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(name, DIR), 'utf8'));
  db.prepare("INSERT INTO inquiry_records (id, kind, ref, label) VALUES (?, 'rule', ?, 'モーダルのz-indexを固定値で書かない')").run(RULE, RULE.slice(5));
  db.exec("INSERT INTO inquiry_records (id, kind, ref) VALUES ('commit:nekoserver/x@aaaa', 'commit', 'nekoserver/x@aaaa')");
  return db;
}
const check = (db, candidates, at) => Number(db.prepare(
  'INSERT INTO inquiry_rule_checks (rule_id, target_ref, method, candidates, checked_by, checked_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(RULE, 'nekoserver/x@aaaa:src/', 'z-index: 数字 と zIndex = 数字', candidates, 'codex', at).lastInsertRowid);
const find = (db, location, checkId, status = 'candidate') => db.prepare(
  'INSERT INTO inquiry_rule_findings (rule_id, location, status, found_check_id) VALUES (?, ?, ?, ?)').run(RULE, location, status, checkId);

test('点検1回分と、見つかった箇所を記録する。同じルールの同じ箇所は1行', () => {
  const db = migrated();
  const id = check(db, 277, '2026-11-08T06:00:00Z');
  find(db, 'src/views/status.ts:2566', id);
  assert.throws(() => find(db, 'src/views/status.ts:2566', id), /UNIQUE/);
  assert.throws(() => check(db, -1, '2026-11-08T06:00:00Z'), /CHECK/);
  assert.throws(() => db.prepare("INSERT INTO inquiry_rule_checks (rule_id, target_ref, method, candidates, checked_by) VALUES ('rule:無い', 't', 'm', 0, 'x')").run(), /FOREIGN KEY/);
  assert.throws(() => find(db, 'src/a.ts:1', 999), /FOREIGN KEY/);
});

test('状態は5つだけ。直したにするには、直したコミット(台帳)と時刻が要り、直した以外では持てない', () => {
  const db = migrated();
  const id = check(db, 1, '2026-11-08T06:00:00Z');
  find(db, 'src/views/status.ts:2566', id);
  assert.throws(() => db.exec("UPDATE inquiry_rule_findings SET status = 'maybe'"), /CHECK/);
  assert.throws(() => db.exec("UPDATE inquiry_rule_findings SET status = 'fixed'"), /CHECK/);
  assert.throws(() => db.exec("UPDATE inquiry_rule_findings SET status = 'fixed', fixed_by_id = 'commit:nekoserver/x@zzzz', fixed_at = '2026-11-08T07:00:00Z'"), /FOREIGN KEY/);
  assert.throws(() => db.exec("UPDATE inquiry_rule_findings SET status = 'violation', fixed_by_id = 'commit:nekoserver/x@aaaa', fixed_at = '2026-11-08T07:00:00Z'"), /CHECK/);
  db.exec("UPDATE inquiry_rule_findings SET status = 'fixed', fixed_by_id = 'commit:nekoserver/x@aaaa', fixed_at = '2026-11-08T07:00:00Z'");
  assert.equal(db.prepare('SELECT status FROM inquiry_rule_findings').get().status, 'fixed');
});

test('ルールごとに、最新の点検の候補数と、状態ごとの件数(直した件数を含む)を数える', () => {
  const db = migrated();
  const first = check(db, 277, '2026-11-08T06:00:00Z');
  find(db, 'src/views/status.ts:2566', first, 'violation');
  find(db, 'src/views/heritageJourney.ts:257', first, 'not_violation');
  find(db, 'src/views/repositories.ts:932', first);
  find(db, 'src/views/legacy.ts:10', first, 'exception');
  db.exec("UPDATE inquiry_rule_findings SET status = 'fixed', fixed_by_id = 'commit:nekoserver/x@aaaa', fixed_at = '2026-11-09T00:00:00Z' WHERE location = 'src/views/status.ts:2566'");
  check(db, 276, '2026-11-09T06:00:00Z');
  const row = { ...db.prepare('SELECT * FROM inquiry_rule_summary WHERE rule_id = ?').get(RULE) };
  assert.deepEqual(row, {
    rule_id: RULE, label: 'モーダルのz-indexを固定値で書かない', checks: 2, last_checked_at: '2026-11-09T06:00:00Z', last_candidates: 276,
    candidate: 1, violation: 0, not_violation: 1, fixed: 1, exception: 1,
  });
});

test('点検したことのないルールは集計に出ない。点検だけで箇所が無いルールは件数0で出る', () => {
  const db = migrated();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inquiry_rule_summary').get().n, 0);
  check(db, 0, '2026-11-08T06:00:00Z');
  const row = { ...db.prepare('SELECT * FROM inquiry_rule_summary').get() };
  assert.equal(row.last_candidates, 0);
  assert.deepEqual([row.candidate, row.violation, row.not_violation, row.fixed, row.exception], [0, 0, 0, 0, 0]);
});
